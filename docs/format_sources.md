# MapleStory WZ Format Reference Sources

## Core Open Source Projects

### MapleLib
A .NET library for parsing and modifying MapleStory `.wz` files.  
Used by HaRepacker and widely referenced by the private server community.

- https://github.com/lastbattle/MapleLib

Relevant areas:
- WZ parsing
- encryption/version handling
- image decoding
- node/property structures
- sound/image extraction
- serialization logic

---

### HaRepacker / HaSuite
One of the most widely used GUI editors for MapleStory WZ files.

- https://github.com/lastbattle/Harepacker-resurrected

Relevant areas:
- real-world editing workflows
- item/map/NPC structures
- WZ navigation conventions
- practical handling of malformed data

---

### WzComparerR2
Longstanding WZ inspection and comparison tool.

- https://github.com/Kagamia/WzComparerR2

Relevant areas:
- WZ diffing
- client version compatibility
- rendering/game asset interpretation
- map and UI extraction

---

### MapleStoryUnity Awesome List
Community-curated collection of MapleStory reverse-engineering tools and libraries.

- https://github.com/MapleStoryUnity/awesome-maplestory

Useful for discovering:
- parsers
- emulators
- packet tooling
- data extraction utilities
- historical projects

---

## Community Reverse Engineering Resources

### RageZone
Historically one of the largest MapleStory reverse-engineering communities.

- https://forum.ragezone.com/

Useful for:
- undocumented WZ behaviors
- encryption details
- PNG/image decoding quirks
- format changes across versions
- packet structures

Example:
- https://forum.ragezone.com/threads/new-wz-png-format-decode-code.1114978/

---

### OdinMS-era Emulator Sources
Many MapleStory private server projects contain practical knowledge of data structures.

Examples:
- OdinMS
- HeavenMS
- ZZMS
- TitanMS forks

Useful for:
- item metadata interpretation
- NPC/shop relationships
- skill formulas
- mob/map extraction logic

---

## Commonly Referenced Concepts

These projects collectively document or imply the following WZ concepts:

- WZ directory tree structure
- UOL references
- property node types
- image/audio embedding
- version/encryption schemes
- string tables
- map structures
- mob stats
- item/equip metadata
- NPC shop definitions
- skill metadata
- quest structures
- rendering metadata

---

## Important Caveat

There is no official public specification from Nexon for the WZ format.

Almost all available knowledge comes from:
- reverse engineering
- source code inspection
- experimentation
- emulator development
- community tooling