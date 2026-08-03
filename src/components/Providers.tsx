"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * アプリ全体のクライアント側プロバイダ。
 *
 * QueryClient は useState の初期化関数で1度だけ作る。
 * モジュールスコープに置くとサーバー側で全リクエストに共有されてしまい、
 * 利用者間でキャッシュが混ざる。
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 駅マスタはほぼ変わらないので、画面を離れても取り直さない
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
