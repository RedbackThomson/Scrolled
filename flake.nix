{
  description = "Scrolled — dev shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        # Node 22 (current LTS). Engines spec requires >=20.
        nodejs = pkgs.nodejs_22;
      in {
        devShells.default = pkgs.mkShell {
          name = "scrolled-dev";

          packages = [
            nodejs
            pkgs.corepack_22
            pkgs.git
            pkgs.supabase-cli
          ];

          shellHook = ''
            export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

            # Activate the pnpm version pinned in package.json's packageManager field.
            corepack prepare --activate >/dev/null 2>&1 || true

            echo "scrolled dev shell"
            echo "  node:   $(node --version)"
            echo "  pnpm:   $(pnpm --version 2>/dev/null || echo 'run: corepack prepare')"
            echo
            echo "Quickstart:"
            echo "  pnpm install"
            echo "  pnpm dev"
          '';
        };
      });
}
