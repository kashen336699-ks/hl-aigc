const e = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,5})$/;
const t = "0.0.0",
	n = new Set(
		(typeof FRAME_RUNTIME_DISABLE == "string" ? FRAME_RUNTIME_DISABLE : "")
			.split(",")
			.map((e) => e.trim())
			.filter(Boolean)
	);
const o = new Set(["remote_control"]);
function r(r, i) {
	const s = r.contract,
		a = typeof s == "string" && ((c = s), e.test(c)) ? s : t;
	var c;
	const l = ((e) => {
			const t = {};
			for (const [n, r] of Object.entries(e.capabilities ?? {})) {
				r &&
					typeof r == "object" &&
					!0 !== r.optional &&
					(o.has(n) || (t[n] = { config: r.config }));
			}
			return Object.keys(t).length > 0 ? t : void 0;
		})(r),
		d = Array.isArray(r.changes) ? r.changes : [],
		u =
			a === t
				? { contract: t, changes: [], flags: [], capabilities: l }
				: {
						contract: a,
						changes: d.filter((e) => typeof e == "string" && !n.has(e)),
						flags: [],
						capabilities: l,
					};
	return i && (u.theme = i), u;
}
const i = (e, t) => {
	const n = e?.toLowerCase();
	return void 0 !== n && t.includes(n) ? n : void 0;
};
const s = new URLSearchParams(location.search),
	a =
		window.self === window.top &&
		!("embedded" in document.documentElement.dataset),
	c =
		i(s.get("surface"), [
			"chat",
			"cowork",
			"code",
			"slack",
			"teams",
			"standalone",
		]) ?? (a ? "standalone" : void 0),
	l =
		i(s.get("platform"), ["web", "desktop", "ios", "android", "cli"]) ??
		(() => {
			const e = navigator.userAgent;
			return e.includes(" Electron/")
				? "desktop"
				: /Android/.test(e)
					? "android"
					: /iPad|iPhone|iPod/.test(e) ||
							(e.includes("Macintosh") && navigator.maxTouchPoints > 1)
						? "ios"
						: "web";
		})(),
	d = document.head.querySelector('meta[name="build-timestamp"]')?.content,
	u = (window.__frameSessionId ??= crypto.randomUUID?.() ?? ""),
	m = {
		"X-Frame-CP": "go",
		...(c ? { "X-Frame-Surface": c } : {}),
		"X-Frame-Platform": l,
		...(d ? { "X-Frame-Client-Version": d } : {}),
		...(u ? { "X-Frame-Session-Id": u } : {}),
	},
	f = { good: 0, "needs-improvement": 1, poor: 2 };
let h = [],
	p = [],
	g = [];
const w = {};
let v = !1;
const b = { "csp-violation": 0, "exc-skip": 0, "exc-frameless": 0 },
	y = new WeakSet();
let k = 0,
	_ = !1,
	T = -1,
	S = !1;
function E(e) {
	typeof e == "object" && e !== null && y.add(e);
}
function C(e, t) {
	const n = h.find((n) => n.code === e && n.detail === t);
	if (n) {
		n.n++;
	} else {
		if (h.length >= 50) {
			return;
		}
		const n = b[e];
		if (void 0 !== n) {
			if (n >= 200) {
				return;
			}
			b[e] = n + 1;
		}
		h.push({ code: e, detail: t, t: Date.now(), n: 1 });
	}
	v || ((v = !0), setTimeout(P, 1e3));
}
const L = /^(?:[ \t]*at (?:[^(\n]*\()?|[^:\n]*@)(https?:\S+?):(\d+):(\d+)/gm,
	I = /^(?:[ \t]*at (?:[^(\n]*\()?|[^:\n]*@)[\w-]*-extension:\/\//m,
	j = new Set(
		"IndexSize HierarchyRequest WrongDocument InvalidCharacter NoModificationAllowed NotFound NotSupported InUseAttribute InvalidState Syntax InvalidModification Namespace InvalidAccess TypeMismatch Security Network Abort URLMismatch QuotaExceeded Timeout InvalidNodeType DataClone Encoding NotReadable Unknown Constraint Data TransactionInactive ReadOnly Version Operation NotAllowed OptOut"
			.split(" ")
			.map((e) => e + "Error")
	),
	M = document.head
		.querySelector('meta[name="build-git-hash"]')
		?.content.match(/^[0-9a-f]{1,40}$/)?.[0];
function A(e, t, n) {
	const o = e
		.split("?")[0]
		.split("#")[0]
		.replace(/^(https?:\/\/)[^/]*@/, "$1");
	return o === t || o.startsWith(n)
		? "<shell>"
		: /^https?:\/\/\S+\/assets\/v\d+\/(frame-shell-[\w-]+|vendor-(react|base-ui|base|radix|virtual|ant-icons|ant-cds|frame-shell-thumb)-[\w-]+)\.js$/.test(
					o
				)
			? o
			: "<other>";
}
function x(e, t, n, o) {
	const r = T >= 0 && performance.now() - T < 1e3;
	if (
		n === "unhandledrejection" &&
		e instanceof DOMException &&
		e.name === "AbortError"
	) {
		return void C("exc-skip", r ? "abort-nt" : "abort");
	}
	if (
		n === "unhandledrejection" &&
		typeof e == "object" &&
		e !== null &&
		y.has(e)
	) {
		return void C("exc-skip", r ? "handled-nt" : "handled");
	}
	const i = e,
		s = e instanceof Error,
		a = location.href.split("?")[0].split("#")[0],
		c = location.origin + "/code/artifact/",
		l = String(i?.stack ?? ""),
		d = s ? String(i) : "",
		u = d && l.startsWith(d) ? l.slice(d.length) : l,
		m = [];
	for (const g of u.matchAll(L)) {
		if (m.length >= 30) {
			break;
		}
		m.push({ f: A(g[1], a, c), l: +g[2], c: +g[3] });
	}
	if (m.length === 0 && o && o.lineno > 0) {
		const e = A(o.filename, a, c);
		e !== "<other>" && m.push({ f: e, l: o.lineno, c: o.colno });
	}
	if (m.length === 0) {
		return void C(
			"exc-frameless",
			n !== "unhandledrejection" || s
				? l
					? I.test(u)
						? "extension-scheme"
						: "other"
					: "stackless"
				: "non-error-rejection"
		);
	}
	if (g.length >= 8) {
		return;
	}
	if (t === "shell-uncaught") {
		if (g.length >= 5 || k >= 20) {
			return;
		}
		k++;
	}
	const f = m[0],
		h = m.length === 1 && f.f === "<shell>" && f.l === 1 && f.c < 50,
		p = m.every((e) => e.f === "<shell>" && e.l >= 2),
		w = e instanceof DOMException ? e.name : void 0;
	g.push({
		code: t,
		name:
			w && j.has(w) ? w : String(i?.constructor?.name ?? typeof e).slice(0, 40),
		frames: m,
		t: Date.now(),
		...(n && { via: n }),
		...(o?.filename && {
			ev: { f: A(o.filename, a, c), l: o.lineno, c: o.colno },
		}),
		...(h && { degraded: h }),
		...(p && { injected: p }),
		vis: document.visibilityState === "hidden" ? "hidden" : "visible",
		...(T >= 0 && { transitionMs: Math.round(performance.now() - T) }),
		...(S && { persisted: !0 }),
	}),
		v || ((v = !0), setTimeout(P, 1e3));
}
function O(e, t, n) {
	const o = f[n],
		r = w[e];
	(void 0 !== r && o <= r) ||
		((w[e] = o),
		p.push({ name: e, value: t, rating: n, source: "shell" }),
		P());
}
const [R, $] = [2500, 4e3];
const D = () => {
	T = performance.now();
};
window.addEventListener("pageshow", (e) => {
	e.persisted && ((S = !0), D());
});
for (const dt of ["freeze", "resume"]) {
	document.addEventListener(dt, D);
}
function P() {
	if (h.length === 0 && p.length === 0 && g.length === 0) {
		return;
	}
	const e = JSON.stringify({
		events: h,
		...(p.length > 0 && { vitals: p }),
		...(g.length > 0 && { exceptions: g }),
		...(M && { buildSha: M }),
	});
	(h = []),
		(p = []),
		(g = []),
		(v = !1),
		fetch("/api/frame/telemetry", {
			method: "POST",
			keepalive: !0,
			headers: { ...m, "Content-Type": "application/json" },
			body: e,
		}).catch(E);
}
window.addEventListener("pagehide", () => P()),
	document.addEventListener("visibilitychange", () => {
		D(), document.visibilityState === "hidden" && P();
	});
const U = (e) => {
	if ("timeout" in AbortSignal) {
		return AbortSignal.timeout(e);
	}
	const t = new AbortController();
	return setTimeout(() => t.abort(), e), t.signal;
};
let F;
const q = () =>
		(F ??= import(
			"https://assets-proxy.anthropic.com/claude-ai/v2/assets/v1/frame-shell-deferred-Br99tR7L.js"
		)),
	B = (e) => {
		q().then(e, () => {});
	};
function N(e) {
	return !!e.capabilities && Object.keys(e.capabilities).some((e) => !o.has(e));
}
const W = (e) => document.getElementById(e),
	H = (e) => document.getElementById(e),
	V = "frame-content",
	z = () => {
		const e = document.documentElement.dataset.mode;
		return e === "light" || e === "dark" ? e : "system";
	};
let X = null,
	Z = null;
const J = (e) =>
		e.kind === "public"
			? "public"
			: e.kind === "authed" && void 0 === e.assetToken
				? "tokenless"
				: void 0,
	Q = /^[A-Za-z0-9_-]{1,64}$/,
	Y = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
	G = new RegExp(`^[A-Za-z0-9_-]{24}\\.${Y}\\.${Y}\\.[0-9]{1,12}$`),
	K = /^[A-Za-z0-9_.|-]{1,512}$/,
	ee = /^[A-Za-z0-9_-]{16,64}$/,
	te = new RegExp(`^${Y}$`),
	ne = W("frame-slot"),
	{ frameUuid: oe, frameUchost: re } = ne.dataset;
document.addEventListener("securitypolicyviolation", (e) => {
	e.disposition !== "report" &&
		((e.effectiveDirective === "frame-src" && _) ||
			C("csp-violation", e.effectiveDirective));
}),
	window.addEventListener("error", (e) => {
		e.error && x(e.error, "shell-uncaught", "error", e);
	}),
	window.addEventListener("unhandledrejection", (e) =>
		x(e.reason, "shell-uncaught", "unhandledrejection")
	);
const ie = new URLSearchParams(location.search),
	se = ie.get("org"),
	ae = ie.get("via") ?? (a ? "user_open" : ""),
	ce = document.cookie.match(/(?:^|;\s*)lastActiveOrg=([^;]*)/)?.[1];
let le = se && te.test(se) ? se : ce && te.test(ce) ? ce : void 0,
	de = !1,
	ue = null;
let me = !1;
const fe = 2e3;
let he = 0,
	pe = !1,
	ge = fe,
	we = !1;
const ve = () => {
		window.clearTimeout(he), (pe = !1), (ge = fe);
	},
	be = () => {
		window.clearTimeout(he),
			(pe = !0),
			(he = window.setTimeout(
				() => {
					(pe = !1), ne.isConnected && ((we = !0), it());
				},
				ge * (0.8 + 0.4 * Math.random())
			)),
			(ge = Math.min(2 * ge, 3e5));
	},
	ye = fetch("/api/account", { credentials: "same-origin", signal: U(8e3) })
		.then((e) => (e.ok ? e.json() : null))
		.catch((e) => (E(e), null));
let ke = 0,
	_e = null,
	Te = null,
	Se = !1,
	Ee = !1,
	Ce = 0,
	Le = 0,
	Ie = null;
const je = new WeakMap();
let Me,
	Ae = null,
	xe = 0,
	Oe = null,
	Re = null,
	$e = null,
	De = !1;
const Pe = new Promise((e) => {
	Me = e;
});
let Ue,
	Fe = "",
	qe = null,
	Be = "";
function Ne(e) {
	(Be = e), H("loading")?.remove();
	const t = W("err");
	t.hidden = !1;
	const n = e === "timeout" || e === "iframe-error";
	(t.textContent = n
		? "Something went wrong loading this artifact."
		: "Page not found."),
		n || document.body.classList.add("err");
	const o = ke;
	B((n) => {
		Be === e &&
			ke === o &&
			n.paintFail(t, e, { frameUuid: oe, bootOrg: le, bootSucceeded: Ee });
	}),
		n && !Ee && tt();
}
function We(e) {
	je.get(e)?.(), (e.onload = null), (e.onerror = null);
}
function He() {
	window.clearTimeout(Ce), window.clearTimeout(Le);
	for (const e of [H(V), Ie]) {
		e instanceof HTMLIFrameElement && We(e), e?.remove();
	}
	Ie = null;
}
function Ve(e) {
	return (
		De ||
		Re !== null ||
		!!document.querySelector('[data-cds="ConfirmationDialog"]') ||
		!!document.querySelector("[data-frame-inert-claim]") ||
		!e.classList.contains("ready")
	);
}
function ze() {
	const e = H(V);
	e instanceof HTMLIFrameElement && (e.inert = Ve(e));
}
const Xe = 8e3,
	Ze = 6e4,
	Je = [];
let Qe = null;
function Ye(e) {
	for (Qe = e; Je.length; ) {
		e(Je.shift());
	}
}
function Ge(e) {
	window.clearTimeout(Ce),
		window.clearTimeout(Le),
		Ie && (We(Ie), Ie.remove(), (Ie = null));
	const t = H(V),
		n = t instanceof HTMLIFrameElement ? t : null;
	n &&
		(n.classList.contains("ready")
			? ((n.onload = null), (n.onerror = null))
			: We(n));
	const o = document.createElement("iframe");
	var i, s;
	(o.title = "User-generated artifact content"),
		(o.dataset.ver = e.ver),
		(o.dataset.tokened = String(void 0 !== e.assetToken)),
		o.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms"),
		(o.referrerPolicy = "no-referrer"),
		(o.src =
			((i = e.ver),
			void 0 === (s = e.assetToken)
				? `https://${re}/_f/${i}/`
				: `https://${re}/_f/${i}/?__frame_t=${encodeURIComponent(s)}&__frame_v=manifest.21ba44c2bfde1499.json`)),
		(o.inert = !0);
	const a = new URL(o.src).origin;
	let c = !1,
		l = !1,
		d = !1,
		u = !1,
		m = 0;
	const f = (t) => {
			if (t.origin === a && t.source === o.contentWindow) {
				if (
					((e) =>
						e != null && typeof e == "object" && !0 === e.__frame_connect)(
						t.data
					)
				) {
					const t = !l;
					l = !0;
					const n = X !== null,
						i = n ? z() : void 0;
					o.contentWindow?.postMessage({ __frame_init: r(e, i) }, a),
						t && n && (Z = i ?? null);
				} else {
					((e) => e != null && typeof e == "object" && !0 === e.__frame_ready)(
						t.data
					) && ((d = !0), v());
				}
			}
		},
		h = () => {
			window.clearTimeout(m),
				window.removeEventListener("message", f),
				je.delete(o),
				(o.onload = null),
				(o.onerror = null);
		},
		p = () => {
			window.clearTimeout(Ce),
				window.clearTimeout(Le),
				window.clearTimeout(m),
				(o.onload = null),
				(o.onerror = null);
		},
		g = () => {
			p(),
				(() => {
					if (!_) {
						const e = performance.now();
						O(
							"mount",
							e,
							e < R ? "good" : e < $ ? "needs-improvement" : "poor"
						);
					}
					_ = !0;
				})(),
				n && (We(n), n.remove()),
				(Ie = null),
				(o.id = V),
				o.classList.add("ready"),
				(o.inert = Ve(o));
			const e = document.activeElement;
			o.inert ||
				(e !== null && e !== document.body && e !== ne) ||
				o.focus({ preventScroll: !0 }),
				H("loading")?.remove(),
				De || (Se = !0);
		},
		w = (t) => {
			p(),
				h(),
				o.remove(),
				(Ie = null),
				C(t, t === "iframe-error" ? J(e) : void 0),
				qe === o.dataset.ver && (qe = null),
				n?.isConnected && n.classList.contains("ready")
					? ue &&
						n.dataset.ver &&
						(ue = {
							...ue,
							ver: n.dataset.ver,
							tokened: n.dataset.tokened === "true",
							brokered: !1,
						})
					: (n && (We(n), n.remove()),
						(Se = !1),
						Ne(t === "iframe-timeout" ? "timeout" : t));
		},
		v = (e = !1) => {
			!u &&
				c &&
				o.isConnected &&
				(d || e) &&
				((u = !0), e && !l && C("kernel-connect-missing"), g());
		};
	return (
		window.addEventListener("message", f),
		je.set(o, h),
		(o.onload = () => {
			(c = !0),
				window.clearTimeout(Ce),
				window.clearTimeout(Le),
				v(),
				u || (m = window.setTimeout(() => v(!0), 50));
		}),
		(o.onerror = () => w("iframe-error")),
		n ? (Ie = o) : (o.id = V),
		ne.appendChild(o),
		(Ce = window.setTimeout(() => {
			const e = H("loading");
			e &&
				!e.classList.contains("slow") &&
				(e.classList.add("slow"),
				e.append(
					((e, t, ...n) => {
						const o = document.createElement(e);
						return o.append(...n), o;
					})(
						"span",
						0,
						"Still loading. This may take a moment on slower connections."
					)
				));
		}, Xe)),
		(Le = window.setTimeout(() => w("iframe-timeout"), Ze)),
		o
	);
}
function Ke(e) {
	return (
		(typeof e.capabilities == "object" &&
			e.capabilities !== null &&
			"mcp" in e.capabilities) ||
		void 0
	);
}
function et() {
	const e = document.querySelector("#hdr-degraded .degraded-title");
	e && (e.textContent = Fe);
}
function tt() {
	document.body.classList.add("chrome-degraded");
	const e = _e;
	if (((_e = null), e && setTimeout(() => e.unmount(), 0), $e)) {
		$e?.(), ze(), ne.focus();
		const e = H("loading");
		e && (e.hidden = !1);
	}
	et();
}
const nt = { ok: !0 },
	ot = { ok: !1, kind: "denied" },
	rt = { ok: !1, kind: "network" };
function it() {
	if (Ae) {
		return (we = !1), Ae;
	}
	const e = st(++xe).finally(() => {
		Be !== "401" || Ee || pe || be(), Ae === e && (Ae = null);
	});
	return (Ae = e), e;
}
function st(e) {
	const t = we;
	we = !1;
	const n = new URLSearchParams(location.search).get("sk"),
		r = new URLSearchParams();
	le && r.set("org", le),
		ae && r.set("via", ae),
		n && ee.test(n) && r.set("sk", n),
		qe !== null && r.set("ver", qe);
	const i = r.toString(),
		s = `/api/frame/${oe}${i ? `?${i}` : ""}`,
		a = window,
		c = a.__frameBootPrefetch;
	let l;
	if (
		(c && (a.__frameBootPrefetch = void 0),
		c && c.url !== s && (c.res.catch(E), C("boot-prefetch-miss")),
		c?.url === s)
	) {
		l = c.res;
	} else {
		try {
			l = fetch(s, { credentials: "same-origin", headers: m, signal: U(2e4) });
		} catch (d) {
			l = Promise.reject(d);
		}
	}
	return l
		.then(async (n) => {
			if (e !== xe) {
				return rt;
			}
			if (n.status === 403 || n.status === 404) {
				ve();
				const e = n.status === 403 ? await n.json().catch(() => null) : null;
				if (
					!de &&
					e?.reason === "org_mismatch" &&
					typeof e.owner_org == "string" &&
					te.test(e.owner_org)
				) {
					return (
						(de = !0),
						(le = e.owner_org),
						(ue = null),
						C("boot-org-autoswitch"),
						st(++xe)
					);
				}
				if (
					(C("boot-status", String(n.status)),
					(ue = null),
					B((e) => {
						e.teardownBroker(), e.stopLive();
					}),
					$e?.(),
					He(),
					Re?.(),
					Te &&
						((Te = { ...Te, boot: { perm: { role: "denied" } } }),
						_e?.update(Te)),
					typeof e?.request_access == "boolean" && oe)
				) {
					H("loading")?.remove();
					const t = W("err");
					return (
						(t.hidden = !1),
						(Be = "request-access"),
						document.body.classList.add("err"),
						(document.title = "Request access \u2013 Claude"),
						(t.textContent = "You don't have access to this artifact."),
						B((n) => n.paintRequestAccess(t, oe, le, !1 === e.request_access)),
						ot
					);
				}
				return Ne(String(n.status)), ot;
			}
			if (n.status === 401 && !Ee) {
				return (
					C("boot-status", t ? "401-probe" : "401-initial"),
					Be !== "401" && Ne("401"),
					ot
				);
			}
			if (!n.ok) {
				return (
					C("boot-status", String(n.status)),
					Be !== "401" || Ee
						? (ue || Ne(String(n.status)), Ee || (ge = fe), rt)
						: rt
				);
			}
			const r = await n.json(),
				i = (e) => ({
					kind: e,
					ver: r.ver,
					title: r.title,
					favicon: r.favicon,
					mode: r.mode,
					...(e === "authed" && !0 === r.reportEnabled
						? { reportEnabled: !0 }
						: {}),
					...(e === "authed" && typeof r.perm?.role == "string"
						? { perm: { role: r.perm.role } }
						: {}),
				}),
				s =
					r.kind === "public"
						? i("public")
						: r.kind === "authed" && void 0 === r.assetToken
							? i("authed")
							: r,
				a =
					s.kind === "public" ||
					(s.kind === "authed" && void 0 === s.assetToken);
			if (
				typeof s.ver != "string" ||
				!Q.test(s.ver) ||
				(!a && (typeof s.assetToken != "string" || !G.test(s.assetToken)))
			) {
				return (
					C("boot-bad-upstream", J(r)),
					Be !== "401" || Ee
						? (ue || Ne("bad-upstream"), Ee || (ge = fe), rt)
						: rt
				);
			}
			(typeof s.wsToken == "string" && K.test(s.wsToken)) || delete s.wsToken,
				(typeof s.share_key == "string" && ee.test(s.share_key)) ||
					delete s.share_key,
				(Fe = typeof s.title == "string" ? s.title : ""),
				(document.title = Fe || "Claude"),
				document.body.classList.contains("chrome-degraded") && et(),
				s.perm?.role === "owner"
					? void 0 !== s.versions && (Ue = s.versions)
					: (Ue = void 0),
				(Te = ((e) => ({
					boot: {
						ver: e.ver,
						title: e.title,
						perm: e.perm,
						owner_agent: e.owner_agent,
						author: e.author,
						created_at: e.created_at,
						updated_at: e.updated_at,
						live: e.live,
						shared: e.shared,
						history: e.history,
						versions: e.versions ?? Ue,
						last_edit: e.last_edit,
						share_key: e.share_key,
						pending_request_count: e.pending_request_count,
						pending_request_kick: Te?.boot.pending_request_kick,
						themeToggle: !0 === e.themeToggle,
						reportEnabled: e.reportEnabled,
						publicView: e.kind === "public" || void 0,
						softDeleted: !0 === e.softDeleted || void 0,
						mcpDeclared: qe === null ? Ke(e) : void 0,
					},
					frameUuid: oe ?? "",
					remoteControl: e.capabilities?.remote_control,
					restoreContent: ze,
					org: le,
					accountPrefetch: ye,
					preview: (e) => B((t) => t.preview(e)),
					report: C,
				}))(s)),
				_e?.update(Te);
			const c = ue,
				l = ((e) => {
					const t = e.capabilities ?? {};
					return Object.keys(t)
						.filter((e) => {
							const n = t[e];
							return (
								!!n && typeof n == "object" && !0 !== n.optional && !o.has(e)
							);
						})
						.sort()
						.join(",");
				})(s);
			ue = {
				ver: s.ver,
				wsToken: s.wsToken,
				tokened: !a,
				brokered: N(s),
				caps: l,
			};
			const d = s.capabilities?.mcp?.token;
			if (
				((Oe =
					typeof d == "string" && d !== "" && typeof s.assetToken == "string"
						? { token: d, org: le, assetToken: s.assetToken }
						: null),
				(Ee = !0),
				ke++,
				ve(),
				c ||
					(() => {
						if (me || !oe) {
							return;
						}
						(me = !0),
							import(
								"https://assets-proxy.anthropic.com/claude-ai/v2/assets/v1/frame-shell-chrome-Du_9J2E_.js"
							).then(
								(e) => {
									let t = !1;
									const n = (e) => {
										(t = !0),
											Me(!1),
											tt(),
											x(e, "chrome-mount"),
											console.error(e),
											C("chrome-mount");
									};
									try {
										if (Te === null) {
											return n("no ctx");
										}
										const o = H("hdr");
										if (!o) {
											return Me(!1), tt(), void C("chrome-mount", "no-hdr");
										}
										const r = e.mount(o, Te, n);
										t ? setTimeout(() => r.unmount(), 0) : ((_e = r), Me(!0));
									} catch (o) {
										n(o);
									}
								},
								(e) => {
									Me(!1), tt(), x(e, "chrome-load"), C("chrome-load");
								}
							);
					})(),
				!0 === s.themeToggle
					? X ||
						((X = new MutationObserver(() => {
							const e = z();
							if (e === Z) {
								return;
							}
							const t = [H(V), Ie].filter(
								(e) =>
									e instanceof HTMLIFrameElement && e.contentWindow !== null
							);
							if (t.length === 0) {
								return;
							}
							Z = e;
							const n = { __frame_theme: { theme: e } };
							for (const o of t) {
								o.contentWindow?.postMessage(n, new URL(o.src).origin);
							}
						})),
						X.observe(document.documentElement, {
							attributes: !0,
							attributeFilter: ["data-mode"],
						}))
					: (X?.disconnect(), (X = null), (Z = null)),
				B((t) => t.afterBoot(s, c, le, e)),
				!N(s) && (B((e) => e.teardownBroker()), $e))
			) {
				$e?.(), ze(), ne.focus();
				const e = H("loading");
				e && (e.hidden = !1);
			}
			if (
				!c ||
				c.ver !== s.ver ||
				c.tokened !== !a ||
				(!c.brokered && l !== "") ||
				(N(s) && (c.caps ?? "") !== l) ||
				!H(V)
			) {
				window.clearTimeout(Ce), window.clearTimeout(Le);
				for (const t of ne.querySelectorAll("iframe")) {
					t.classList.contains("ready") || We(t);
				}
				const e = Date.now();
				N(s)
					? await q()
							.then((t) => t.applyBoot(s, e, le))
							.catch(() => {
								C("broker-load", "deferred"),
									B((e) => e.teardownBroker()),
									at(),
									Ge(s);
							})
					: (at(), Ge(s));
			} else {
				N(s) && B((e) => e.refreshBrokerToken(s, le));
			}
			return nt;
		})
		.catch((e) => {
			E(e);
			const t = e instanceof DOMException && e.name === "TimeoutError";
			return (
				C(t ? "boot-fetch-timeout" : "boot-fetch-error"),
				Be !== "401" || Ee
					? (ue || Ne(t ? "timeout" : "upstream"), Ee || (ge = fe), rt)
					: rt
			);
		});
}
function at() {
	window.clearTimeout(Ce), window.clearTimeout(Le);
	for (const t of ne.querySelectorAll("iframe")) {
		t.classList.contains("ready") || We(t);
	}
	if ($e) {
		$e?.(), ze(), ne.focus();
		const e = H("loading");
		e && (e.hidden = !1);
	}
	const e = W("err");
	(e.hidden = !0),
		e.replaceChildren(),
		(Be = ""),
		document.body.classList.remove("err");
}
const ct = {
	contentInertClaim: Ve,
	restoreContentInteractivity: ze,
	unmountIframe: He,
	clearForRemount: at,
	fail: Ne,
	markHandled: E,
	setCloseNavConfirm: (e) => {
		Re = e;
	},
	callCloseNavConfirm: () => Re?.(),
	setCloseConsent: (e) => {
		$e = e;
	},
	callCloseConsent: () => $e?.(),
	setDecisionSurfaceOpen: (e) => {
		De = e;
	},
	decisionSurfaceOpen: () => De,
	chromeReady: () => Pe,
	setPreviewVer: (e) => {
		qe = e;
	},
	setBrokered: (e) => {
		ue && (ue = { ...ue, brokered: e });
	},
	getPreviewVer: () => qe,
	getCurrent: () => ue,
	getContentShown: () => Se,
	getBootEpoch: () => xe,
	getLastBootMcp: () => Oe,
	isBootInFlight: () => Ae !== null,
	getOwnerVersions: () => Ue,
	setOwnerVersions: (e) => {
		Ue = e;
	},
	setContentShown: (e) => {
		Se = e;
	},
	inertContent: () => {
		const e = H(V);
		e instanceof HTMLIFrameElement && (e.inert = !0);
	},
	updateChrome: (e) => {
		(Te = e), _e?.update(e);
	},
	getChromeCtx: () => Te,
	getChrome: () => _e,
	mount: Ge,
	boot: it,
	slot: ne,
	report: C,
	reportVital: O,
	cpHeaders: m,
	byId: H,
	CONTENT_ID: V,
	CONFIRM_OPEN: '[data-cds="ConfirmationDialog"]:not([data-ending-style])',
	frameUuid: oe ?? "",
	frameOrigin: () => `https://${re}`,
};
var lt;
B((e) => e.install(ct, Ye)),
	oe && void 0 !== re
		? ((lt = `https://${re}`),
			window.addEventListener("message", (e) => {
				if (!ne.isConnected) {
					return;
				}
				if (e.origin !== lt) {
					return;
				}
				const t = H(V);
				if (!(t instanceof HTMLIFrameElement)) {
					return;
				}
				if (e.source !== t.contentWindow) {
					return;
				}
				const n = { e, f: t };
				Qe ? Qe(n) : Je.length < 64 && Je.push(n);
			}),
			window.addEventListener("pageshow", (e) => {
				e.persisted && ne.isConnected && it();
			}),
			it())
		: (C(void 0 === oe ? "boot-missing-attrs" : "boot-status", "400"),
			Ne("404"));
