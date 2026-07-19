// apps/go-api/main.go
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Profile struct {
	Login       string  `json:"login"`
	Name        *string `json:"name"`
	Company     *string `json:"company"`
	Blog        *string `json:"blog"`
	Location    *string `json:"location"`
	Bio         *string `json:"bio"`
	PublicRepos int     `json:"publicRepos"`
	Followers   int     `json:"followers"`
	Following   int     `json:"following"`
}

var pool *pgxpool.Pool

func main() {
	ctx := context.Background()

	var err error
	pool, err = pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}

	// 预览环境的 postgres sidecar 是张白纸 → 启动时自动建表 + 塞演示数据
	if os.Getenv("PREVIEW_SEED") == "1" {
		if err := ensureSchemaAndSeed(ctx); err != nil {
			log.Fatalf("seed: %v", err)
		}
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("GET /profile/{login}", handleProfile)
	mux.HandleFunc("GET /intro/{login}", handleIntro)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("go-api listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux)) // 监听 0.0.0.0，容器内必需
}

// ===== 从 Node (drizzle) 迁移过来的查询 =====
func queryProfile(ctx context.Context, login string) (*Profile, error) {
	row := pool.QueryRow(ctx,
		`SELECT login, name, company, blog, location, bio,
		        public_repos, followers, following
		   FROM github_users WHERE login = $1`, login)
	var p Profile
	err := row.Scan(&p.Login, &p.Name, &p.Company, &p.Blog, &p.Location,
		&p.Bio, &p.PublicRepos, &p.Followers, &p.Following)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &p, err
}

func handleProfile(w http.ResponseWriter, r *http.Request) {
	p, err := queryProfile(r.Context(), r.PathValue("login"))
	if err != nil {
		httpError(w, http.StatusInternalServerError, err)
		return
	}
	if p == nil {
		http.Error(w, `{"error":"user not synced"}`, http.StatusNotFound)
		return
	}
	writeJSON(w, p)
}

func handleIntro(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
	defer cancel()

	p, err := queryProfile(ctx, r.PathValue("login"))
	if err != nil {
		httpError(w, http.StatusInternalServerError, err)
		return
	}
	if p == nil {
		http.Error(w, `{"error":"user not synced"}`, http.StatusNotFound)
		return
	}
	intro, err := generateIntro(ctx, p)
	if err != nil {
		httpError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, map[string]any{"profile": p, "intro": intro})
}

// ===== 调 OpenAI 兼容网关生成个人介绍（默认 OpenRouter，可经 LLM_BASE_URL 切换） =====
func generateIntro(ctx context.Context, p *Profile) (string, error) {
	model := os.Getenv("LLM_MODEL")
	if model == "" {
		model = "openai/gpt-4o-mini"
	}
	baseURL := os.Getenv("LLM_BASE_URL")
	if baseURL == "" {
		baseURL = "https://openrouter.ai/api/v1"
	}
	profileJSON, _ := json.Marshal(p)
	payload, _ := json.Marshal(map[string]any{
		"model": model,
		"messages": []map[string]string{{
			"role":    "user",
			"content": "根据这份 GitHub 公开资料，用中文写一段 80 字左右的第三人称个人介绍，突出技术特点，不要编造资料里没有的信息：\n" + string(profileJSON),
		}},
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		strings.TrimSuffix(baseURL, "/")+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+os.Getenv("LLM_API_KEY"))
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("llm gateway %d: %s", resp.StatusCode, raw)
	}
	var out struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &out); err != nil || len(out.Choices) == 0 {
		return "", fmt.Errorf("unexpected llm gateway response: %s", raw)
	}
	return out.Choices[0].Message.Content, nil
}

// ===== 预览/本地环境自举：建表 + 演示数据（只含 Go 用到的列） =====
func ensureSchemaAndSeed(ctx context.Context) error {
	_, err := pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS github_users (
  id           text PRIMARY KEY,
  github_id    text NOT NULL UNIQUE,
  login        text NOT NULL,
  name         text, company text, blog text, location text, bio text,
  public_repos integer NOT NULL DEFAULT 0,
  followers    integer NOT NULL DEFAULT 0,
  following    integer NOT NULL DEFAULT 0
);
INSERT INTO github_users (id, github_id, login, name, company, location, public_repos, followers, following)
VALUES ('demo', '583231', 'octocat', 'The Octocat', 'GitHub', 'San Francisco', 8, 9999, 9)
ON CONFLICT (github_id) DO NOTHING;`)
	return err
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(v)
}

func httpError(w http.ResponseWriter, code int, err error) {
	log.Printf("error: %v", err)
	body, _ := json.Marshal(map[string]string{"error": err.Error()})
	http.Error(w, string(body), code)
}
