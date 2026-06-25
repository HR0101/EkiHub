# GitHub Actions による自動デプロイ（CI/CD）設定手順

このドキュメントでは、GitHub の `main` ブランチにコードがプッシュされた際、Oracle Cloud の VM（サーバー）へ自動でデプロイ（`git pull` および `pm2 restart`）を行う CI/CD パイプラインの構築手順を解説します。

---

## 仕組みの概要

1. 手元でコードを編集し、GitHub の `main` ブランチに push します。
2. GitHub Actions がそれを検知し、自動的にワークフローを起動します。
3. GitHub Actions の仮想環境が、登録された SSH 鍵を使って Oracle Cloud の VM にログインします。
4. VM 上で最新コードの pull、パッケージの更新、および Node.js アプリ（PM2）の再起動を実行します。

---

## Step 1: デプロイ用の SSH 鍵を作成する（ローカルPC）

GitHub Actions から VM にアクセスするための専用の SSH 鍵を作成します。セキュリティの観点から、普段使っている鍵とは別に作成することをお勧めします。

手元のターミナル（Mac）で以下のコマンドを実行します：

```bash
# 鍵ペアの作成（パスフレーズは空のまま Enter を押してください）
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/id_ed25519_github_actions

# 作成されたことを確認
ls -l ~/.ssh/id_ed25519_github_actions*
```

---

## Step 2: サーバー（Oracle Cloud VM）に公開鍵を登録する

作成した **公開鍵**（`id_ed25519_github_actions.pub`）の中身を、デプロイ先サーバーに登録します。

1. **ローカルPC** で公開鍵の中身を表示してコピーします：
   ```bash
   cat ~/.ssh/id_ed25519_github_actions.pub
   ```
   （`ssh-ed25519 AAA... github-actions-deploy` のような文字列をコピー）

2. **サーバー（Oracle Cloud VM）** にログインします：
   ```bash
   ssh ubuntu@<あなたのサーバーのIPアドレス>
   ```

3. サーバー上で `authorized_keys` にコピーした公開鍵を追記します：
   ```bash
   nano ~/.ssh/authorized_keys
   ```
   ファイルの末尾に新しい行を作成し、コピーした公開鍵を貼り付けて保存（`Ctrl+O` → `Enter` → `Ctrl+X`）します。

---

## Step 3: GitHub リポジトリに秘密鍵とサーバー情報を登録する

次に、GitHub Actions がサーバーにアクセスできるように **秘密鍵** と接続情報を GitHub の Secrets に登録します。

1. **ローカルPC** で秘密鍵の中身を表示してコピーします：
   ```bash
   cat ~/.ssh/id_ed25519_github_actions
   ```
   （`-----BEGIN OPENSSH PRIVATE KEY-----` から `-----END OPENSSH PRIVATE KEY-----` まで全てコピー）

2. GitHub の EkiHub リポジトリページを開き、**Settings** > **Secrets and variables** > **Actions** に移動します。
3. **「New repository secret」** をクリックして、以下の3つのシークレットを登録します。

| Name | Secret (Value) |
|---|---|
| `SSH_PRIVATE_KEY` | 先ほどコピーした秘密鍵の文字列をすべて貼り付けます |
| `SERVER_HOST` | サーバー（Oracle Cloud VM）のパブリック IP アドレス |
| `SERVER_USERNAME` | `ubuntu` （Oracle Cloud Ubuntu イメージのデフォルトユーザー） |

---

## Step 4: GitHub Actions のワークフローを作成する

ローカルのプロジェクト内に、デプロイ用の設定ファイルを作成します。

1. リポジトリのルートディレクトリ（`EkiHub` の直下）に `.github/workflows` フォルダを作成します。
2. その中に `deploy.yml` というファイルを作成し、以下の内容を記述します。

```yaml
name: Deploy to Oracle Cloud

on:
  push:
    branches:
      - main  # mainブランチにpushされた時のみ実行

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Deploy to Server via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USERNAME }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            # サーバー上でのデプロイコマンド
            cd ~/EkiHub
            
            # 最新のコードを取得
            git fetch origin
            git reset --hard origin/main
            
            # 依存関係のインストール（本番環境用のみ）
            npm install --omit=dev
            
            # PM2でアプリを再起動
            pm2 restart ekihub
```

---

## Step 5: コミットしてプッシュする

作成した `.github/workflows/deploy.yml` をコミットして GitHub にプッシュします。

```bash
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Actions deployment workflow"
git push origin main
```

プッシュ後、GitHub のリポジトリページ上部にある **「Actions」** タブを開くと、`Deploy to Oracle Cloud` というワークフローが実行されているのが確認できます。

緑色のチェックマーク（✅）がつけばデプロイ成功です！以降は `main` ブランチにプッシュするたびに、この処理が自動で実行され、常に最新のコードがサーバーで動くようになります。

---

## トラブルシューティング

- **SSH接続エラー (Timeout / Connection Refused)**
  GitHub Actions からサーバーへの通信がブロックされている可能性があります。Oracle Cloud の VCN の設定（Security Lists）で、SSH接続（ポート22番）が `0.0.0.0/0` から許可されているか確認してください。
- **鍵の認証エラー (Permission denied)**
  公開鍵が正しくサーバーの `~/.ssh/authorized_keys` に追記されているか、GitHub Secrets に登録した秘密鍵に改行漏れや余分なスペースがないか確認してください。
- **PM2 エラー (pm2: command not found)**
  SSH接続時にパスが通っていない場合があります。その場合は `deploy.yml` の `pm2` の部分を `/usr/bin/pm2` や `/home/ubuntu/.npm-global/bin/pm2` のようにフルパスで指定してみてください。
