// A virtual directory tree reconstructed from the relative paths of an
// uploaded folder of standalone `.img` files. The folder layout mirrors a WZ
// archive's directory tree, so this rebuilds the same logical structure the
// `WzDataSource` exposes — top-level folder `Item` is presented as the logical
// file `Item.wz`, so extractor paths (`Item.wz/Consume/0200/0200.img/...`)
// match unchanged.

export interface ImgTreeNode {
  /** Path segment: a folder name, or an `.img` file name on image leaves. */
  name: string;
  kind: 'dir' | 'image';
  children: Map<string, ImgTreeNode>;
  /** Set only on image leaves — the source to lazily read bytes from. */
  source?: File | string;
}

export interface ImgDataset {
  /** Logical roots keyed by `<Folder>.wz` (e.g. `Item.wz` → folder `Item`). */
  roots: Map<string, ImgTreeNode>;
}

export interface ImgFileSpec {
  /** Slash-separated relative path, e.g. `Item/Consume/0200/0200.img`. */
  relPath: string;
  source: File | string;
}

const IMG_RE = /\.img$/i;

/** Map a top-level folder name to its logical WZ file name (`Item` → `Item.wz`). */
export function logicalRootName(topFolder: string): string {
  return /\.wz$/i.test(topFolder) ? topFolder : `${topFolder}.wz`;
}

/**
 * Build the virtual tree. Each spec's first path segment becomes a logical
 * root; the remaining segments are nested folders ending at an `.img` leaf.
 * Specs with fewer than two segments (a bare `.img` at the top, no folder) or
 * non-`.img` leaves are ignored.
 */
export function buildImgDataset(specs: ImgFileSpec[]): ImgDataset {
  const roots = new Map<string, ImgTreeNode>();
  for (const spec of specs) {
    const segments = spec.relPath.split('/').filter(Boolean);
    if (segments.length < 2) continue;
    const leaf = segments[segments.length - 1]!;
    if (!IMG_RE.test(leaf)) continue;

    const logical = logicalRootName(segments[0]!);
    let node: ImgTreeNode = roots.get(logical) ?? {
      name: logical,
      kind: 'dir',
      children: new Map(),
    };
    roots.set(logical, node);
    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i]!;
      const isLeaf = i === segments.length - 1;
      let child: ImgTreeNode | undefined = node.children.get(seg);
      if (!child) {
        child = { name: seg, kind: isLeaf ? 'image' : 'dir', children: new Map() };
        node.children.set(seg, child);
      }
      if (isLeaf) child.source = spec.source;
      node = child;
    }
  }
  return { roots };
}
