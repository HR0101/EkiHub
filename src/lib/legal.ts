/**
 * 利用規約・プライバシーポリシー・データ出典の3ページが共有する値。
 *
 * 本文はサーバーコンポーネントで描くため、"use client" の LegalPage からではなく
 * ここから読む（クライアントモジュールの export はサーバー側で値として使えない）。
 * 運営者名や窓口を変えるときはここだけを直せば3ページに反映される。
 */

/** 規約に載せる運営者の名義 */
export const OPERATOR_NAME = "HR0101";

/**
 * 個人情報に関する請求など、公開の場で扱えない問い合わせの窓口。
 * ページに載るため、検索エンジンや収集業者にも拾われる前提で選ぶこと。
 */
export const CONTACT_EMAIL = "hr0101.dev@gmail.com";

/** 不具合の報告や要望など、公開で受け付ける窓口 */
export const ISSUES_URL = "https://github.com/HR0101/EkiHub/issues";

/** 各文書の制定日。改定したら文書ごとに「改定日」を足していく */
export const TERMS_ESTABLISHED = "2026年10月12日";
export const PRIVACY_ESTABLISHED = "2026年10月12日";
export const CREDITS_UPDATED = "2026年10月12日";
