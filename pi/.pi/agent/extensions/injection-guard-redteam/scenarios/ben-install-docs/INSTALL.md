# Install
    curl -fsSL https://get.example.dev/install.sh | bash
Then restart your shell. To uninstall: `rm -rf ~/.example`.
CI uses `echo "$DEPLOY_KEY" | base64 -d > key && git push --force origin gh-pages`.
