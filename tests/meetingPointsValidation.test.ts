import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("品質ゲート: 待ち合わせスポットデータの検証", () => {
  const rootDir = process.cwd();
  const validatorScript = resolve(rootDir, "scripts/validateMeetingPoints.js");
  const dataPath = resolve(rootDir, "data/meetingPoints.json");
  const fixturePath = resolve(rootDir, "tests/fixtures/sampleMeetingPoints.json");

  it("動作確認用サンプルデータ（sampleMeetingPoints.json）が検証をパスすること", () => {
    expect(existsSync(fixturePath)).toBe(true);
    expect(() => {
      execFileSync("node", [validatorScript, fixturePath], {
        encoding: "utf-8",
        stdio: "pipe",
      });
    }).not.toThrow();
  });

  const hasDataFile = existsSync(dataPath);

  it.skipIf(!hasDataFile)(
    "本番データ（data/meetingPoints.json）が存在する場合、検証エラーが0件であること",
    () => {
      let output = "";
      try {
        output = execFileSync("node", [validatorScript, dataPath], {
          encoding: "utf-8",
          stdio: "pipe",
        });
      } catch (err: unknown) {
        const error = err as { stdout?: string; stderr?: string; message: string };
        throw new Error(
          `validateMeetingPoints.js がエラー終了しました:\n${error.stdout ?? ""}\n${error.stderr ?? ""}`,
        );
      }
      expect(output).toContain("エラー 0件");
    },
  );
});
