# Theme icons

Y2K以外の7テーマ用ベクターアイコン。

- `theme-icons.ai`: Illustrator 2026で保存した編集用マスター（PDF互換）。7テーマを名前付きグループとして収録。
- `theme-icons-export.svg`: Illustratorから書き出したSVG。
- `../../public/theme-icons/*.svg`: 上記SVGの各テーマを分離し、320×210の表示領域を設定したWeb用ファイル。
- `preview.html`: Web用7点の一覧。
- `theme-icons-source.svg` / `*-draft.svg`: Illustratorへ取り込んだベクター原稿。

アプリでは `src/components/ThemeArtwork.tsx` からWeb用SVGを読み込む。Y2Kは既存のインラインSVGを維持。
