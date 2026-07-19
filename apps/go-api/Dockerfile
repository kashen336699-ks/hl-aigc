# apps/go-api/Dockerfile
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /go-api .

FROM alpine:3.21
RUN apk add --no-cache ca-certificates   # 没有它，HTTPS 调 openrouter 会证书报错
COPY --from=build /go-api /go-api
EXPOSE 8080
ENTRYPOINT ["/go-api"]
