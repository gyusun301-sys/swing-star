#!/usr/bin/env node
// index.html 안의 인라인 JS 를 추출해 `node --check` 로 문법 검사한다.
//
// 이 저장소에는 빌드도 린터도 테스트도 없고, push 하면 곧바로 GitHub Pages 로
// 라이브 반영된다. 즉 오타 하나가 아무 저항 없이 공개 사이트를 깨뜨릴 수 있다.
// 이 훅이 그 유일한 안전망이다.
//
// 사용: node .claude/hooks/check-syntax.mjs <pre-commit|post-edit>
//   pre-commit : git commit 직전. 실패 시 exit 2 로 커밋 자체를 막는다.
//   post-edit  : index.html 편집 직후. 실패 시 exit 2 로 즉시 알린다.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const mode = process.argv[2] === "pre-commit" ? "pre-commit" : "post-edit";

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
} catch {}

// input.cwd 를 우선 쓰되, 해석되지 않으면 실제 작업 디렉터리로 폴백한다.
// (잘못된 경로를 받고 조용히 통과해 버리면 안전망이 안전망이 아니게 된다)
const candidates = [input.cwd, process.cwd()].filter(Boolean);
const target = candidates
  .map((d) => path.join(d, "index.html"))
  .find((p) => fs.existsSync(p));

// 훅은 모든 Bash/Edit 호출마다 실행되므로, 관련 없는 호출은 조용히 통과시킨다
if (mode === "pre-commit") {
  const cmd = (input.tool_input && input.tool_input.command) || "";
  if (!/\bgit\s+commit\b/.test(cmd)) process.exit(0);
} else {
  const f = (input.tool_input && input.tool_input.file_path) || "";
  if (path.basename(f).toLowerCase() !== "index.html") process.exit(0);
}

if (!target) process.exit(0); // 이 프로젝트가 아님

const html = fs.readFileSync(target, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) {
  console.error("[문법검사] index.html 에서 <script> 블록을 찾지 못했습니다.");
  process.exit(2);
}

// node --check 가 보고하는 행 번호를 index.html 기준으로 되돌리기 위한 보정값
const lineOffset = html.slice(0, html.indexOf(m[1])).split("\n").length - 1;

const tmp = path.join(os.tmpdir(), "swingstar-syntax-" + process.pid + ".js");
fs.writeFileSync(tmp, m[1]);

let err = null;
try {
  execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" });
} catch (e) {
  err = (e.stderr && e.stderr.toString()) || e.message;
}
try {
  fs.unlinkSync(tmp);
} catch {}

if (!err) process.exit(0);

// 첫 줄의 "<임시경로>:<행>" 을 "index.html:<실제 행>" 으로 치환.
// 정규식 이스케이프를 피하려고 문자열 조작만 사용한다 (경로에 \ 와 공백이 섞여 있음).
const lines = err.split("\n");
if (lines[0].startsWith(tmp + ":")) {
  const n = parseInt(lines[0].slice(tmp.length + 1), 10);
  if (Number.isFinite(n)) lines[0] = "index.html:" + (n + lineOffset);
}
err = lines.join("\n").split(tmp).join("index.html");

console.error(
  (mode === "pre-commit"
    ? "[문법검사] 커밋을 중단했습니다 — index.html 의 JS 에 문법 오류가 있습니다."
    : "[문법검사] index.html 의 JS 에 문법 오류가 있습니다. 다음 작업 전에 고치세요.") +
    "\n" +
    err.trim()
);
process.exit(2);
