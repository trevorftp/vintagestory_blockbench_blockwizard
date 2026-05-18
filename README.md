# Vintage Story Block Wizard for Blockbench

`vintagestory_block_wizard.js` is a companion plugin for creating starter
Vintage Story block content mods from inside Blockbench.

This README is only for the block wizard. The required base plugin is
[vintagestory_wizard.js](https://github.com/trevorftp/vintagestory_blockbench)

## What It Does

- Adds **Tools > Vintage Story Block Wizard...**
- Adds a **Vintage Story Block Wizard** card to Blockbench's New screen
- Walks through preset, block info, appearance, properties, world settings,
  drops, sounds, advanced JSON, export, and next steps
- Creates a new content mod or adds the block to an existing unzipped mod
- Generates blocktype JSON, language entries, textures, and optional local shape
  JSON
- Uses real Vintage Story block presets when the base plugin can find the game
  assets folder
- Opens the generated block back in Blockbench for editing

## Requirements

- Blockbench 4.10 or newer
- The base **Vintage Story Support** plugin loaded first
- Desktop Blockbench for filesystem export features
- A Vintage Story assets folder is kinda optional, but recommended/required for real preset
  previews, vanilla textures, and the default mod icon

## Install

1. Open Blockbench.
2. Load [vintagestory_wizard.js](https://github.com/trevorftp/vintagestory_blockbench) from **File > Plugins**.
3. Load [vintagestory_block_wizard.js](vintagestory_block_wizard.js) the same way.
4. Open **Tools > Vintage Story Block Wizard...** or choose the wizard card from
   the New screen.

The plugin id must match the file name, so keep the file named
`vintagestory_block_wizard.js`.

## Basic Use

1. Pick a preset or start from a simple shape.
2. Fill in the block code, display name, and texture settings.
3. Choose the block shape and collision behavior.
4. Set gameplay properties like material, resistance, creative tab, drops, and
   sounds.
5. Export as a new mod or integrate the block into an existing unzipped mod.
6. Use the Next Steps page to open the block, open the mod folder, copy the
   block id, or launch Vintage Story.

## Editing Generated Blocks

If a block starts from a built-in Vintage Story preset shape, the wizard opens a
copy for editing. When you save it as a Vintage Story Block Model, the base
plugin writes a new local shape JSON into your mod and updates the blocktype JSON
to point at that new shape. The original game shape is not changed.

If you start from a custom JSON shape or the current Blockbench model, the wizard
already exports that shape into the mod.

## Export Layout

A new mod export creates this structure:

```text
modroot/
  modinfo.json
  assets/modid/blocktypes/blockcode.json
  assets/modid/lang/en.json
  assets/modid/textures/block/blockcode.png
  assets/modid/shapes/block/blockcode.json
```

The shape file is only written when the block needs its own local shape.

## License

This project uses the MIT License. See [LICENSE](LICENSE).
