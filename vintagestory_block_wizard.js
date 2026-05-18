(function () {
'use strict';

const FACE_KEYS = ['north', 'east', 'south', 'west', 'up', 'down'];

let block_codec = {
    load(content_or_model, file, args) {
        let api = require_vs_api();
        if (api && typeof api.loadBlockShape === 'function') return api.loadBlockShape(content_or_model, file, args);
        return null;
    }
};
let block_format = { id: 'vintagestory_block' };

function setupProject(format) {
    if (format !== block_format) return;
    let api = require_vs_api();
    if (api && typeof api.setupBlockProject === 'function') return api.setupBlockProject();
}

function get_assets_root() {
    let api = get_vs_api();
    return api && typeof api.getAssetsRoot === 'function' ? api.getAssetsRoot() : '';
}

function is_vs_format() {
    let api = get_vs_api();
    return !!(api && typeof api.isVsFormat === 'function' && api.isVsFormat());
}

function parse_vs_json(text) {
    let api = require_vs_api();
    if (!api || typeof api.parseJson !== 'function') throw new Error('Vintage Story Support parser is unavailable.');
    return api.parseJson(text);
}

function compile_vs_shape() {
    let api = require_vs_api();
    if (!api || typeof api.compileShape !== 'function') throw new Error('Vintage Story Support shape compiler is unavailable.');
    return api.compileShape();
}

function load_vs_texture_data(rel_path) {
    let api = get_vs_api();
    if (!api || typeof api.loadTextureData !== 'function') return null;
    return api.loadTextureData(rel_path);
}

function vs_build_shape_group(shape, texture_map) {
    let api = require_vs_api();
    if (!api || typeof api.buildShapeGroup !== 'function') throw new Error('Vintage Story Support shape preview builder is unavailable.');
    return api.buildShapeGroup(shape, texture_map);
}

function vs_wizard_node_modules() {
    let mods = { path: null, fs: null, os: null };
    try {
        if (typeof require !== 'undefined') {
            mods.path = require('path');
            mods.fs   = require('fs');
            mods.os   = require('os');
        }
    } catch (_) {}
    return mods;
}

function vs_wizard_default_mods_folder(path_mod) {
    // default vs data folder by platform
    try {
        let os_mod = require('os');
        let plat = os_mod.platform();
        let home = os_mod.homedir();
        if (plat === 'win32') {
            return path_mod.join(home, 'AppData', 'Roaming', 'VintageStoryData', 'Mods');
        }
        if (plat === 'darwin') {
            return path_mod.join(home, 'Library', 'Application Support', 'VintageStoryData', 'Mods');
        }
        return path_mod.join(home, '.config', 'VintageStoryData', 'Mods');
    } catch (_) {}
    return '';
}

function vs_wizard_open_in_explorer(folder) {
    // desktop file manager
    try {
        let child = require('child_process');
        let os_mod = require('os');
        let plat = os_mod.platform();
        if (plat === 'win32') {
            child.spawn('explorer.exe', [folder], { detached: true, stdio: 'ignore' }).unref();
        } else if (plat === 'darwin') {
            child.spawn('open', [folder], { detached: true, stdio: 'ignore' }).unref();
        } else {
            child.spawn('xdg-open', [folder], { detached: true, stdio: 'ignore' }).unref();
        }
    } catch (e) {
        console.warn('[vs_wizard] could not open folder:', e);
    }
}

function vs_wizard_open_in_vscode(folder) {
    try {
        let child = require('child_process');
        let proc = child.spawn('code', ['-n', folder], { detached: true, stdio: 'ignore' });
        proc.on('error', e => {
            console.warn('[vs_wizard] could not open VS Code:', e);
            Blockbench.showQuickMessage('Could not open VS Code from the code command', 2200);
        });
        proc.unref();
    } catch (e) {
        console.warn('[vs_wizard] could not open VS Code:', e);
        Blockbench.showQuickMessage('Could not open VS Code from the code command', 2200);
    }
}

function vs_wizard_file_url(file_path) {
    let path = String(file_path || '').replace(/\\/g, '/');
    if (!path) return '';
    if (!/^file:\/\//i.test(path)) {
        path = /^[a-z]:/i.test(path) ? 'file:///' + path : 'file://' + path;
    }
    return encodeURI(path).replace(/#/g, '%23').replace(/\?/g, '%3F').replace(/"/g, '%22');
}

function vs_wizard_random_background_url() {
    if (typeof require === 'undefined') return '';
    try {
        let path_mod = require('path');
        let fs_mod = require('fs');
        let root = get_assets_root();
        let dirs = [];
        if (root) {
            dirs.push(
                path_mod.join(root, 'game', 'textures', 'gui', 'backgrounds'),
                path_mod.join(root, 'assets', 'game', 'textures', 'gui', 'backgrounds'),
                path_mod.join(root, 'textures', 'gui', 'backgrounds'),
                path_mod.join(root, 'gui', 'backgrounds')
            );
        }
        for (let i = 0; i < dirs.length; i++) {
            let dir = dirs[i];
            if (!dir || !fs_mod.existsSync(dir)) continue;
            let files = fs_mod.readdirSync(dir).filter(file => /\.png$/i.test(file));
            let mainmenu = files.filter(file => /^mainmenu.*\.png$/i.test(file));
            let pool = mainmenu.length ? mainmenu : files;
            if (!pool.length) continue;
            let picked = pool[Math.floor(Math.random() * pool.length)];
            return vs_wizard_file_url(path_mod.join(dir, picked));
        }
    } catch (e) {
        console.warn('[vs_wizard] could not pick New screen background', e);
    }
    return '';
}

function vs_wizard_read_modinfo(path_mod, fs_mod, mod_root) {
    try {
        let modinfo_path = path_mod.join(mod_root, 'modinfo.json');
        if (fs_mod.existsSync(modinfo_path)) return parse_vs_json(fs_mod.readFileSync(modinfo_path, 'utf8'));
    } catch (e) {
        console.warn('[vs_wizard] failed to read modinfo for ' + mod_root, e);
    }
    return null;
}

function vs_wizard_mod_icon_path(path_mod, fs_mod, mod_root, modinfo) {
    let icon_refs = [];
    if (modinfo && typeof modinfo.iconpath === 'string') icon_refs.push(modinfo.iconpath);
    if (modinfo && typeof modinfo.iconPath === 'string') icon_refs.push(modinfo.iconPath);
    if (modinfo && modinfo.modid) {
        icon_refs.push('assets/' + modinfo.modid + '/textures/gui/modicon.png');
        icon_refs.push('assets/' + modinfo.modid + '/textures/gui/icon.png');
    }
    icon_refs.push('modicon.png', 'icon.png', 'pack_icon.png');
    for (let i = 0; i < icon_refs.length; i++) {
        let ref = String(icon_refs[i] || '').trim();
        if (!ref) continue;
        let candidate = path_mod.isAbsolute(ref) ? ref : path_mod.join(mod_root, ref);
        try { if (fs_mod.existsSync(candidate)) return candidate; }
        catch (_) {}
    }
    return '';
}

function vs_wizard_mod_entry_from_folder(path_mod, fs_mod, mod_root) {
    let modinfo = vs_wizard_read_modinfo(path_mod, fs_mod, mod_root) || {};
    let folder_name = path_mod.basename(mod_root);
    let mod_id = String(modinfo.modid || folder_name).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    let name = String(modinfo.name || folder_name).trim() || folder_name;
    let icon_path = vs_wizard_mod_icon_path(path_mod, fs_mod, mod_root, modinfo);
    return {
        id: mod_id,
        name: name,
        path: mod_root,
        icon_path: icon_path,
        icon_url: icon_path ? vs_wizard_file_url(icon_path) : ''
    };
}

function vs_wizard_existing_mods(path_mod, fs_mod, mods_root) {
    let mods = [];
    if (!mods_root) return mods;
    try {
        if (!fs_mod.existsSync(mods_root)) return mods;
        fs_mod.readdirSync(mods_root, { withFileTypes: true }).forEach(entry => {
            if (!entry || !entry.isDirectory || !entry.isDirectory()) return;
            let mod_root = path_mod.join(mods_root, entry.name);
            if (!fs_mod.existsSync(path_mod.join(mod_root, 'modinfo.json'))) return;
            mods.push(vs_wizard_mod_entry_from_folder(path_mod, fs_mod, mod_root));
        });
    } catch (e) {
        console.warn('[vs_wizard] failed to list existing mods in ' + mods_root, e);
    }
    mods.sort((a, b) => a.name.localeCompare(b.name));
    return mods;
}

function vs_wizard_icon_source_name(source) {
    source = String(source || '');
    if (!source) return 'Select Image...';
    if (source.indexOf('data:image') === 0) return 'Selected Image';
    return source.replace(/\\/g, '/').split('/').pop() || 'Selected Image';
}

function vs_wizard_icon_source_url(source) {
    source = String(source || '').trim();
    if (!source) return '';
    if (source.indexOf('data:image') === 0) return source;
    return vs_wizard_file_url(source);
}

function vs_wizard_default_mod_icon_source(path_mod, fs_mod) {
    return vs_wizard_find_asset_texture(path_mod, fs_mod, 'gui/3rdpartymodicon') || load_vs_texture_data('gui/3rdpartymodicon.png') || '';
}

function vs_wizard_write_mod_icon(fs_mod, path_mod, mod_root, source, modinfo) {
    source = String(source || '').trim();
    if (!source) return;
    let icon_path = path_mod.join(mod_root, 'modicon.png');
    try {
        if (source.indexOf('data:image') === 0) {
            let comma = source.indexOf(',');
            if (comma >= 0) fs_mod.writeFileSync(icon_path, Buffer.from(source.slice(comma + 1), 'base64'));
        } else if (fs_mod.existsSync(source)) {
            fs_mod.copyFileSync(source, icon_path);
        } else {
            return;
        }
        modinfo.iconpath = 'modicon.png';
    } catch (e) {
        console.warn('[vs_wizard] failed to write mod icon', e);
    }
}

function vs_wizard_find_vintage_story_exe(path_mod, fs_mod) {
    let candidates = [];
    let assets_root = get_assets_root();
    if (assets_root) {
        candidates.push(
            path_mod.join(assets_root, '..', 'Vintagestory.exe'),
            path_mod.join(assets_root, '..', 'VintageStory.exe'),
            path_mod.join(assets_root, '..', '..', 'Vintagestory.exe')
        );
    }
    for (let i = 0; i < candidates.length; i++) {
        try { if (fs_mod.existsSync(candidates[i])) return path_mod.normalize(candidates[i]); }
        catch (_) {}
    }
    return '';
}

function vs_wizard_launch_vintage_story(path_mod, fs_mod) {
    try {
        let exe = vs_wizard_find_vintage_story_exe(path_mod, fs_mod);
        if (!exe) {
            Blockbench.showQuickMessage('Could not find Vintage Story. Open it from your launcher.', 2500);
            return;
        }
        let child = require('child_process');
        child.spawn(exe, [], { detached: true, stdio: 'ignore', cwd: path_mod.dirname(exe) }).unref();
    } catch (e) {
        console.warn('[vs_wizard] could not launch Vintage Story', e);
        Blockbench.showQuickMessage('Could not launch Vintage Story automatically', 2500);
    }
}

function open_vs_block_wizard_from_loader() {
    let mods = vs_wizard_node_modules();
    if (!mods.path || !mods.fs) {
        Blockbench.showQuickMessage('VS Block Wizard requires desktop Blockbench (Node fs unavailable)', 2500);
        return;
    }
    open_vs_block_wizard(mods.path, mods.fs);
}

// quick presets, keep apply keys aligned with the wizard form
const VS_BLOCK_PRESETS = [
    { id: 'cube',     name: 'Solid Cube',  icon: 'check_box_outline_blank',
      desc: 'Plain 6-sided block. Stone-like defaults.',
      apply: () => ({ drawtype: 'Cube', blockmaterial: 'Stone', resistance: 3.5,
                      required_mining_tier: 1, block_code: 'simpleblock',
                      block_display_name: 'Simple Block', sound_place: 'game:block/rock',
                      sound_walk: 'game:walk/stone', sound_break: 'game:block/rock' }) },
    { id: 'wood',     name: 'Planks',      icon: 'grid_on',
            desc: 'Wooden cube. Axe-mined and soft.',
      apply: () => ({ drawtype: 'Cube', blockmaterial: 'Wood', resistance: 2.5,
                      required_mining_tier: 0, block_code: 'planks',
                      block_display_name: 'Planks', sound_place: 'game:block/planks',
                      sound_walk: 'game:walk/wood', sound_break: 'game:block/planks' }) },
    { id: 'log',      name: 'Log',         icon: 'view_column',
      desc: 'Wood log. Axe-mined, higher resistance.',
      apply: () => ({ drawtype: 'Cube', blockmaterial: 'Wood', resistance: 4.5,
                      required_mining_tier: 0, block_code: 'log',
                      block_display_name: 'Log', sound_place: 'game:block/planks',
                      sound_walk: 'game:walk/wood', sound_break: 'game:block/planks' }) },
    { id: 'glass',    name: 'Glass',       icon: 'crop_square',
      desc: 'Transparent cube, fragile.',
      apply: () => ({ drawtype: 'Cube', blockmaterial: 'Glass', resistance: 0.3,
                      required_mining_tier: 0, block_code: 'glassblock',
                      block_display_name: 'Glass', sound_place: 'game:block/glass',
                      sound_walk: 'game:walk/stone', sound_break: 'game:block/glass' }) },
    { id: 'soil',     name: 'Soil',        icon: 'terrain',
      desc: 'Dirt-like. Shovel-friendly.',
      apply: () => ({ drawtype: 'Cube', blockmaterial: 'Soil', resistance: 0.6,
                      required_mining_tier: 0, block_code: 'soilblock',
                      block_display_name: 'Soil', sound_place: 'game:block/soil',
                      sound_walk: 'game:walk/grass', sound_break: 'game:block/soil' }) },
    { id: 'sand',     name: 'Sand',        icon: 'beach_access',
      desc: 'Sand-like granular block.',
      apply: () => ({ drawtype: 'Cube', blockmaterial: 'Sand', resistance: 0.5,
                      required_mining_tier: 0, block_code: 'sandblock',
                      block_display_name: 'Sand', sound_place: 'game:block/gravel',
                      sound_walk: 'game:walk/gravel', sound_break: 'game:block/gravel' }) },
    { id: 'gravel',   name: 'Gravel',      icon: 'grain',
            desc: 'Gravel. Same family as sand.',
      apply: () => ({ drawtype: 'Cube', blockmaterial: 'Gravel', resistance: 0.7,
                      required_mining_tier: 0, block_code: 'gravelblock',
                      block_display_name: 'Gravel', sound_place: 'game:block/gravel',
                      sound_walk: 'game:walk/gravel', sound_break: 'game:block/gravel' }) },
    { id: 'leaves',   name: 'Leaves',      icon: 'park',
      desc: 'Leaf-like cube. Cheap to break.',
      apply: () => ({ drawtype: 'Cube', blockmaterial: 'Leaves', resistance: 0.3,
                      required_mining_tier: 0, block_code: 'leavesblock',
                      block_display_name: 'Leaves', sound_place: 'game:block/leaves',
                      sound_walk: 'game:walk/grass', sound_break: 'game:block/leaves' }) },
    { id: 'plant',    name: 'Flower',      icon: 'local_florist',
      desc: 'X-shape plant (Cross drawtype).',
      apply: () => ({ drawtype: 'Cross', blockmaterial: 'Plant', resistance: 0.3,
                      required_mining_tier: 0, block_code: 'flower',
                      block_display_name: 'Flower', sound_place: 'game:block/plant',
                      sound_walk: 'game:walk/grass', sound_break: 'game:block/plant' }) },
    { id: 'metal',    name: 'Metal Block', icon: 'view_in_ar',
      desc: 'Hard metal cube. Bronze pickaxe.',
      apply: () => ({ drawtype: 'Cube', blockmaterial: 'Metal', resistance: 6,
                      required_mining_tier: 2, block_code: 'metalblock',
                      block_display_name: 'Metal Block', sound_place: 'game:block/anvil',
                      sound_walk: 'game:walk/stone', sound_break: 'game:block/anvil' }) },
    { id: 'cloth',    name: 'Cloth',       icon: 'texture',
      desc: 'Wool / fabric. Soft, easy break.',
      apply: () => ({ drawtype: 'Cube', blockmaterial: 'Cloth', resistance: 1.0,
                      required_mining_tier: 0, block_code: 'clothblock',
                      block_display_name: 'Cloth', sound_place: 'game:block/cloth',
                      sound_walk: 'game:walk/grass', sound_break: 'game:block/cloth' }) },
    { id: 'ceramic',  name: 'Ceramic',     icon: 'emoji_food_beverage',
      desc: 'Fired clay. Medium fragility.',
      apply: () => ({ drawtype: 'Cube', blockmaterial: 'Ceramic', resistance: 1.0,
                      required_mining_tier: 0, block_code: 'ceramicblock',
                      block_display_name: 'Ceramic', sound_place: 'game:block/ceramic',
                      sound_walk: 'game:walk/stone', sound_break: 'game:block/ceramic' }) },
    { id: 'ice',      name: 'Ice',         icon: 'ac_unit',
      desc: 'Slippery, fragile.',
      apply: () => ({ drawtype: 'Cube', blockmaterial: 'Ice', resistance: 0.5,
                      required_mining_tier: 0, block_code: 'iceblock',
                      block_display_name: 'Ice', sound_place: 'game:block/glass',
                      sound_walk: 'game:walk/ice', sound_break: 'game:block/glass' }) },
    { id: 'snow',     name: 'Snow',        icon: 'cloud',
      desc: 'Soft snow block.',
      apply: () => ({ drawtype: 'Cube', blockmaterial: 'Snow', resistance: 0.4,
                      required_mining_tier: 0, block_code: 'snowblock',
                      block_display_name: 'Snow', sound_place: 'game:block/snow',
                      sound_walk: 'game:walk/snow', sound_break: 'game:block/snow' }) },
    { id: 'custom',   name: 'Custom Model',icon: 'extension',
      desc: 'Use current Blockbench model as the shape.',
      apply: () => ({ drawtype: 'JSON', blockmaterial: 'Wood', resistance: 2.5,
                      required_mining_tier: 0, use_current_shape: true,
                      block_code: 'custommodel', block_display_name: 'Custom Model',
                      sound_place: 'game:block/planks', sound_walk: 'game:walk/wood',
                      sound_break: 'game:block/planks' }) },
    { id: 'empty',    name: 'Empty',       icon: 'check_box_outline_blank',
      desc: 'Invisible block (collision / marker only).',
      apply: () => ({ drawtype: 'Empty', blockmaterial: 'Other', resistance: 0.1,
                      required_mining_tier: 0, block_code: 'marker',
                      block_display_name: 'Marker' }) }
];

function build_vs_preset_render(p) {
    let holder = document.createElement('div');
    holder.style.cssText = 'position:relative;width:104px;height:84px;display:flex;align-items:center;justify-content:center;margin-bottom:8px;';
    function add_shape_preview(fallback_node) {
        if (!p || !p.preview_shape) return false;
        let rendered = vs_wizard_render_preset_shape_preview(holder, p);
        if (rendered && fallback_node) fallback_node.style.display = 'none';
        return rendered;
    }
    if (!p.preview_url) {
        add_shape_preview();
        return holder;
    }

    if (p.render === 'cross') {
        let plant = document.createElement('div');
        plant.style.cssText = 'position:relative;width:66px;height:72px;transform-style:preserve-3d;transform:rotateX(-8deg) rotateY(34deg);filter:drop-shadow(0 12px 9px rgba(0,0,0,0.35));';
        ['rotateY(45deg)', 'rotateY(-45deg)'].forEach(transform => {
            let plane = document.createElement('div');
            plane.style.cssText = 'position:absolute;left:11px;bottom:0;width:44px;height:70px;background:url("' + p.preview_url + '") center bottom/contain no-repeat;image-rendering:pixelated;transform:' + transform + ';';
            plant.append(plane);
        });
        holder.append(plant);
        add_shape_preview(plant);
        return holder;
    }

    function iso_box(opts) {
        opts = opts || {};
        let width = opts.width || 78;
        let height = opts.height || 72;
        let left = opts.left == null ? Math.round((104 - width) / 2) : opts.left;
        let top = opts.top == null ? Math.round((84 - height) / 2) : opts.top;
        let top_band = opts.top_band || 28;
        let opacity = opts.opacity || '';
        let shadow = opts.shadow === false ? '' : 'filter:drop-shadow(0 13px 9px rgba(0,0,0,0.3));';
        let box = document.createElement('div');
        box.style.cssText = 'position:absolute;left:' + left + 'px;top:' + top + 'px;width:' + width + 'px;height:' + height + 'px;' + shadow;
        let faces = [
            { clip: 'polygon(50% 0%, 100% ' + top_band + '%, 50% ' + (top_band * 2) + '%, 0% ' + top_band + '%)', shade: 'rgba(255,255,255,0.2)' },
            { clip: 'polygon(0% ' + top_band + '%, 50% ' + (top_band * 2) + '%, 50% 100%, 0% ' + (100 - top_band) + '%)', shade: 'rgba(0,0,0,0.17)' },
            { clip: 'polygon(100% ' + top_band + '%, 50% ' + (top_band * 2) + '%, 50% 100%, 100% ' + (100 - top_band) + '%)', shade: 'rgba(0,0,0,0.28)' }
        ];
        faces.forEach(face => {
            let node = document.createElement('div');
            node.style.cssText = 'position:absolute;inset:0;background-image:linear-gradient(' + face.shade + ',' + face.shade + '),url("' + p.preview_url + '");background-size:48px 48px;image-rendering:pixelated;clip-path:' + face.clip + ';';
            if (opacity) node.style.opacity = opacity;
            box.append(node);
        });
        return box;
    }

    function panel() {
        let box = document.createElement('div');
        box.style.cssText = 'position:absolute;left:22px;top:10px;width:58px;height:68px;filter:drop-shadow(0 13px 9px rgba(0,0,0,0.32));';
        let front = document.createElement('div');
        front.style.cssText = 'position:absolute;inset:0;background:url("' + p.preview_url + '") center/cover;image-rendering:pixelated;clip-path:polygon(12% 12%, 82% 0%, 82% 78%, 12% 96%);';
        let side = document.createElement('div');
        side.style.cssText = 'position:absolute;inset:0;background-image:linear-gradient(rgba(0,0,0,0.32),rgba(0,0,0,0.32)),url("' + p.preview_url + '");background-size:cover;image-rendering:pixelated;clip-path:polygon(82% 0%, 96% 9%, 96% 86%, 82% 78%);';
        box.append(front, side);
        return box;
    }

    if (p.render === 'slab' || p.render === 'glass_slab') {
        let fallback = iso_box({ width: 86, height: 48, top: 30, top_band: 30, opacity: p.render === 'glass_slab' ? '0.76' : '' });
        holder.append(fallback);
        add_shape_preview(fallback);
        return holder;
    }

    if (p.render === 'stair') {
        let stair = document.createElement('div');
        stair.style.cssText = 'position:relative;width:104px;height:84px;';
        let lower = iso_box({ width: 88, height: 44, left: 7, top: 36, top_band: 30 });
        let upper = iso_box({ width: 54, height: 48, left: 31, top: 14, top_band: 28, shadow: false });
        stair.append(lower, upper);
        holder.append(stair);
        add_shape_preview(stair);
        return holder;
    }

    if (p.render === 'flat') {
        let fallback = iso_box({ width: 90, height: 26, top: 48, top_band: 35 });
        holder.append(fallback);
        add_shape_preview(fallback);
        return holder;
    }

    if (p.render === 'panel') {
        let fallback = panel();
        holder.append(fallback);
        add_shape_preview(fallback);
        return holder;
    }

    let fallback = iso_box({ opacity: p.render === 'glass' ? '0.76' : '' });
    holder.append(fallback);
    add_shape_preview(fallback);
    return holder;
}

function vs_wizard_render_preset_shape_preview(holder, preset) {
    if (!preset || !preset.preview_shape || typeof THREE === 'undefined') return false;
    let width = 104;
    let height = 84;
    let image = document.createElement('img');
    image.alt = '';
    image.style.cssText = 'position:absolute;left:0;top:0;width:' + width + 'px;height:' + height + 'px;object-fit:contain;image-rendering:auto;filter:drop-shadow(0 12px 8px rgba(0,0,0,0.3));pointer-events:none;';
    holder.append(image);

    try {
        let renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
        renderer.setClearColor(0x000000, 0);
        renderer.setSize(width, height, false);
        if (typeof window !== 'undefined' && window.devicePixelRatio) renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));

        let scene = new THREE.Scene();
        let texture_overrides = Object.assign({}, preset.preview_textures || {});
        texture_overrides.__tintedKeys = preset.preview_tinted_keys || [];
        let shape_group = vs_build_shape_group(vs_wizard_clone_json(preset.preview_shape), texture_overrides);
        shape_group.__vs_tinted_materials.forEach(material => {
            if (material && material.color) material.color.setHex(0x7fa866);
        });

        let raw_box = new THREE.Box3().setFromObject(shape_group);
        if (!isFinite(raw_box.min.x)) throw new Error('Preset shape has no renderable geometry');
        let raw_center = raw_box.getCenter(new THREE.Vector3());
        shape_group.position.sub(raw_center);

        let wrapper = new THREE.Group();
        wrapper.add(shape_group);
        let flat_preview = preset.render === 'flat' || preset.render === 'panel';
        wrapper.rotation.x = THREE.MathUtils.degToRad(flat_preview ? 58 : 28);
        wrapper.rotation.y = THREE.MathUtils.degToRad(flat_preview ? 32 : 36);
        scene.add(wrapper);
        wrapper.updateMatrixWorld(true);

        let box = new THREE.Box3().setFromObject(wrapper);
        let size = box.getSize(new THREE.Vector3());
        let center = box.getCenter(new THREE.Vector3());
        wrapper.position.sub(center);
        let aspect = width / height;
        let view_height = Math.max(size.y, size.x / aspect, 10) * (flat_preview ? 1.08 : 1.28);
        let camera = new THREE.OrthographicCamera(
            -view_height * aspect / 2,
            view_height * aspect / 2,
            view_height / 2,
            -view_height / 2,
            -500,
            500
        );
        camera.position.set(0, 0, 160);
        camera.lookAt(0, 0, 0);
        scene.add(new THREE.AmbientLight(0xffffff, 0.72));
        let key_light = new THREE.DirectionalLight(0xffffff, 0.7);
        key_light.position.set(25, 45, 70);
        scene.add(key_light);

        let finished = false;
        function render_frame() {
            renderer.render(scene, camera);
            image.src = renderer.domElement.toDataURL('image/png');
        }
        function finish_render() {
            if (finished) return;
            finished = true;
            render_frame();
            try { renderer.dispose(); } catch (_) {}
            try { if (renderer.forceContextLoss) renderer.forceContextLoss(); } catch (_) {}
        }
        shape_group.__vs_on_texture_ready = function () {
            if (!finished) render_frame();
            if (!shape_group.__vs_pending_textures) finish_render();
        };
        render_frame();
        setTimeout(finish_render, shape_group.__vs_pending_textures ? 800 : 80);
        return true;
    } catch (render_error) {
        console.warn('[vs_wizard] preset preview render failed', preset.id, render_error);
        if (image.parentNode) image.parentNode.removeChild(image);
        return false;
    }
}

function build_vs_preset_gallery(presets, on_select) {
    let root = document.createElement('div');
    root.className = 'vs-preset-gallery';
    root.style.cssText = 'display:block;padding:8px 4px 4px;';

    let header = document.createElement('div');
    header.style.cssText = 'padding:0 6px 12px;';
    header.innerHTML =
        '<h3 style="margin:0 0 6px;color:var(--color-accent);">Preset</h3>'
        + '<div style="opacity:0.85;">Pick a real Vintage Story block as the starting behavior, texture, and shape. Your new block keeps its own mod id and name.</div>';
    root.append(header);

    let grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:10px;padding:0 6px;';

    let tiles = {};
    presets.forEach(p => {
        let tile = document.createElement('div');
        tile.className = 'vs-preset-tile';
        tile.dataset.preset = p.id;
        tile.title = p.desc;
        tile.style.cssText =
            'display:flex;flex-direction:column;align-items:center;justify-content:flex-start;'
            + 'min-height:168px;padding:12px 8px;background:var(--color-back);border:2px solid transparent;'
            + 'border-radius:4px;cursor:pointer;text-align:center;transition:background 0.1s,border-color 0.1s;';

        let icon_holder = build_vs_preset_render(p);
        if (!p.preview_url && !p.preview_shape) try {
            let icon_node = Blockbench.getIconNode(p.icon);
            if (icon_node) {
                icon_node.style.fontSize = '36px';
                icon_node.style.width = '36px';
                icon_node.style.height = '36px';
                icon_holder.append(icon_node);
            }
        } catch (_) {}
        tile.append(icon_holder);

        let label = document.createElement('div');
        label.textContent = p.name;
        label.style.cssText = 'font-weight:600;font-size:0.95em;line-height:1.1;';
        tile.append(label);

        let desc = document.createElement('div');
        desc.textContent = p.desc;
        desc.style.cssText = 'font-size:0.78em;opacity:0.7;margin-top:5px;line-height:1.15;max-width:132px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;';
        tile.append(desc);

        if (p.source) {
            let source = document.createElement('div');
            source.textContent = p.source;
            source.style.cssText = 'font-size:0.72em;opacity:0.55;margin-top:5px;text-transform:uppercase;letter-spacing:0.04em;';
            tile.append(source);
        }

        tile.addEventListener('mouseenter', () => {
            if (!tile.classList.contains('selected'))
                tile.style.background = 'var(--color-button)';
        });
        tile.addEventListener('mouseleave', () => {
            if (!tile.classList.contains('selected'))
                tile.style.background = 'var(--color-back)';
        });
        tile.addEventListener('click', () => {
            Object.values(tiles).forEach(t => {
                t.classList.remove('selected');
                t.style.background = 'var(--color-back)';
                t.style.borderColor = 'transparent';
            });
            tile.classList.add('selected');
            tile.style.background = 'var(--color-selected)';
            tile.style.borderColor = 'var(--color-accent)';
            on_select(p);
        });

        tiles[p.id] = tile;
        grid.append(tile);
    });
    root.append(grid);

    return { root, tiles };
}

const VS_ASSET_BLOCK_PRESET_DESCRIPTORS = [
    { id: 'rock_granite', name: 'Granite Rock', rel: 'stone/rock.json', actual_code: 'rock-granite', texture: 'block/stone/rock/granite1', blockmaterial: 'Stone', resistance: 8, required_mining_tier: 2, creative_tab: 'terrain', simple: true, render: 'cube' },
    { id: 'sand_basalt', name: 'Basalt Sand', rel: 'stone/sand.json', actual_code: 'sand-basalt', texture: 'block/stone/sand/basalt', blockmaterial: 'Sand', resistance: 1.8, creative_tab: 'terrain', simple: true, render: 'cube' },
    { id: 'gravel_granite', name: 'Granite Gravel', rel: 'stone/gravel.json', actual_code: 'gravel-granite', texture: 'block/stone/gravel/granite', blockmaterial: 'Gravel', resistance: 2.4, creative_tab: 'terrain', simple: true, render: 'cube' },
    { id: 'soil_medium', name: 'Medium Soil', rel: 'soil/soil.json', actual_code: 'soil-medium-none', texture: 'block/soil/fertmedium', blockmaterial: 'Soil', resistance: 1.8, creative_tab: 'terrain', simple: true, render: 'cube' },
    { id: 'planks_oak', name: 'Oak Planks', rel: 'wood/woodtyped/planks.json', actual_code: 'planks-oak-ud', texture: 'block/wood/planks/oak1', blockmaterial: 'Wood', resistance: 3.5, creative_tab: 'construction', simple: true, render: 'cube' },
    { id: 'oak_plank_slab', name: 'Oak Plank Slab', rel: 'wood/woodtyped/plankslab.json', actual_code: 'plankslab-oak-down-free', texture: 'block/wood/planks/oak1', shape: 'block/basic/slab/slab-down', drawtype: 'JSON', blockmaterial: 'Wood', resistance: 3, creative_tab: 'construction', simple: true, render: 'slab' },
    { id: 'oak_plank_stairs', name: 'Oak Plank Stairs', rel: 'wood/woodtyped/plankstairs.json', actual_code: 'plankstairs-oak-up-north-free', texture: 'block/wood/planks/oak1', shape: 'block/basic/stairs/planks-free-up', drawtype: 'JSON', blockmaterial: 'Wood', resistance: 3, creative_tab: 'construction', simple: true, render: 'stair' },
    { id: 'polished_granite', name: 'Polished Granite', rel: 'stone/polished/polishedrock.json', actual_code: 'rockpolished-granite', texture: 'block/stone/polishedrock/granite', blockmaterial: 'Stone', resistance: 5, required_mining_tier: 1, creative_tab: 'construction', simple: true, render: 'cube' },
    { id: 'plain_glass', name: 'Plain Glass', rel: 'glass/full-plain.json', actual_code: 'glass-plain', texture: 'block/glass/plain', shape: 'block/glass/framed', texture_key: 'material,frame', textures: { material: { base: 'block/glass/plain' }, frame: { base: 'block/glass/frame' } }, texture_mode: 'source', drawtype: 'JSON', blockmaterial: 'Glass', resistance: 0.25, creative_tab: 'construction', renderpass: 'Transparent', simple: true, render: 'glass' },
    { id: 'wooden_path_oak', name: 'Oak Wooden Path', rel: 'wood/woodtyped/path.json', actual_code: 'woodenpath-oak-ns', texture: 'block/wood/path/oak1', shape: 'block/wood/path1', texture_key: 'wood', drawtype: 'JSON', blockmaterial: 'Wood', resistance: 0.4, creative_tab: 'decorative', simple: true, render: 'flat' },
    { id: 'oak_trapdoor', name: 'Oak Trapdoor', rel: 'wood/woodtyped/trapdoor.json', actual_code: 'trapdoor-solid-oak-1', texture: 'block/wood/debarked/oak', shape: 'block/wood/trapdoor/solid1', texture_key: 'material', drawtype: 'JSON', blockmaterial: 'Wood', resistance: 3.5, creative_tab: 'decorative', simple: true, render: 'panel' },
    { id: 'oak_leaves', name: 'Oak Leaves', rel: 'plant/leaves/normal.json', actual_code: 'leaves-placed-oak', texture: 'block/plant/leaves/large/oak1', shape: 'block/plant/leaves/normal', texture_key: 'largeleaves,smallleaves', textures: { largeleaves: { base: 'block/plant/leaves/large/oak1' }, smallleaves: { base: 'block/plant/leaves/small/oak' } }, texture_mode: 'source', drawtype: 'JSON', blockmaterial: 'Leaves', resistance: 0.5, creative_tab: 'flora', renderpass: 'OpaqueNoCull', climate_color_map: 'climatePlantTint', season_color_map: 'seasonalFoliage', tinted_keys: ['largeleaves', 'smallleaves'], simple: true, render: 'leaves' },
    { id: 'daffodil', name: 'Daffodil', rel: 'plant/flower.json', actual_code: 'flower-daffodil-free', texture: 'block/plant/flower/petal/daffodil1', shape: 'block/plant/flower/lilyofthevalley', texture_key: 'stem1,stem2,stem3,petal1,petal2,petal3,leaves1', textures: { stem1: { base: 'block/plant/flower/stem/daffodil1' }, stem2: { base: 'block/plant/flower/stem/daffodil2' }, stem3: { base: 'block/plant/flower/stem/daffodil3' }, petal1: { base: 'block/plant/flower/petal/daffodil1' }, petal2: { base: 'block/plant/flower/petal/daffodil2' }, petal3: { base: 'block/plant/flower/petal/daffodil3' }, leaves1: { base: 'block/plant/flower/stem/daffodilleaves1' } }, texture_mode: 'source', drawtype: 'JSON', blockmaterial: 'Plant', resistance: 0.5, creative_tab: 'flora', renderpass: 'OpaqueNoCull', climate_color_map: 'climatePlantTint', season_color_map: 'seasonalFoliage', tinted_keys: ['stem1', 'stem2', 'stem3', 'leaves1'], simple: true, render: 'cross' },
    { id: 'tallgrass_medium', name: 'Medium Tall Grass', rel: 'plant/tallgrass.json', actual_code: 'tallgrass-medium-free', vars: { tallgrass: 'medium', cover: 'free' }, texture: 'block/plant/tallgrass/free/medium-north', shape: 'block/basic/cross', texture_key: 'north,south', textures: { north: { base: 'block/plant/tallgrass/{cover}/{tallgrass}-north' }, south: { base: 'block/plant/tallgrass/{cover}/{tallgrass}-south' } }, texture_mode: 'source', drawtype: 'JSON', blockmaterial: 'Plant', resistance: 0.5, creative_tab: 'flora', renderpass: 'OpaqueNoCull', climate_color_map: 'climatePlantTint', season_color_map: 'seasonalGrass', tinted_keys: ['north', 'south'], simple: true, render: 'cross' },
    { id: 'iron_sheet_block', name: 'Iron Sheet Block', rel: 'metal/metalblock.json', actual_code: 'metalblock-new-plain-iron', texture: 'block/metal/sheet-plain/iron1', blockmaterial: 'Metal', resistance: 2, required_mining_tier: 2, creative_tab: 'decorative', simple: true, render: 'cube' },
    { id: 'snowblock', name: 'Snow Block', rel: 'liquid/snowblock.json', actual_code: 'snowblock', texture: 'block/liquid/snow/normal1', blockmaterial: 'Snow', resistance: 3.5, creative_tab: 'terrain', simple: true, render: 'cube' },
    { id: 'lakeice', name: 'Lake Ice', rel: 'liquid/lakeice.json', actual_code: 'lakeice', texture: 'block/liquid/ice/lake1', blockmaterial: 'Ice', resistance: 0.5, creative_tab: 'terrain', simple: true, render: 'glass' }
];

function vs_wizard_runtime_asset_domain(domain) {
    domain = String(domain || '').trim();
    if (!domain || domain === 'survival') return 'game';
    return domain;
}

function vs_wizard_normalize_runtime_asset_refs(value) {
    if (typeof value === 'string') return value.replace(/^survival:/i, 'game:');
    if (Array.isArray(value)) return value.map(v => vs_wizard_normalize_runtime_asset_refs(v));
    if (!value || typeof value !== 'object') return value;
    let out = {};
    Object.keys(value).forEach(key => {
        out[key] = vs_wizard_normalize_runtime_asset_refs(value[key]);
    });
    return out;
}

function vs_wizard_domain_ref(ref, domain) {
    ref = String(ref || '').trim();
    if (!ref || ref.indexOf(':') >= 0 || ref.charAt(0) === '#') return ref;
    if (/^(block|item|entity|environment|particle|gui|sounds?)\//i.test(ref)) return vs_wizard_runtime_asset_domain(domain) + ':' + ref;
    return ref;
}

function vs_wizard_prefix_base_refs(value, domain) {
    if (Array.isArray(value)) return value.map(v => vs_wizard_prefix_base_refs(v, domain));
    if (!value || typeof value !== 'object') return value;
    let out = {};
    Object.keys(value).forEach(key => {
        if (key === 'base' && typeof value[key] === 'string') out[key] = vs_wizard_domain_ref(value[key], domain);
        else out[key] = vs_wizard_prefix_base_refs(value[key], domain);
    });
    return out;
}

function vs_wizard_strip_template_fields(value) {
    if (Array.isArray(value)) return value.map(v => vs_wizard_strip_template_fields(v));
    if (!value || typeof value !== 'object') return value;
    let out = {};
    Object.keys(value).forEach(key => {
        if (key === 'variantgroups' || key === 'skipVariants' || /ByType$/.test(key) || key === 'propertiesByType') return;
        out[key] = vs_wizard_strip_template_fields(value[key]);
    });
    return out;
}

function vs_wizard_clone_json(value) {
    if (value === undefined || value === null) return value;
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_) { return value; }
}

function vs_wizard_json_text(value) {
    if (value === undefined) return '';
    return JSON.stringify(value, null, 2);
}

function vs_wizard_known_or_custom(value, known) {
    if (!value) return '';
    return known.indexOf(value) >= 0 ? value : 'custom';
}

function vs_wizard_shape_base(shape) {
    if (!shape || typeof shape !== 'object') return '';
    return typeof shape.base === 'string' ? shape.base : '';
}

function vs_wizard_box_preset_from_value(box) {
    if (box === null) return 'none';
    if (!box || typeof box !== 'object' || Array.isArray(box)) return 'full';
    let x1 = parseFloat(box.x1 || 0), y1 = parseFloat(box.y1 || 0), z1 = parseFloat(box.z1 || 0);
    let x2 = parseFloat(box.x2 == null ? 1 : box.x2), y2 = parseFloat(box.y2 == null ? 1 : box.y2), z2 = parseFloat(box.z2 == null ? 1 : box.z2);
    if (x1 === 0 && y1 === 0 && z1 === 0 && x2 === 1 && y2 === 0.5 && z2 === 1) return 'lower_slab';
    if (x1 === 0 && y1 === 0 && z1 === 0 && x2 === 1 && y2 <= 0.08 && z2 === 1) return 'carpet';
    if (x1 >= 0.2 && x2 <= 0.8 && z1 >= 0.2 && z2 <= 0.8) return 'plant';
    return 'custom';
}

function vs_wizard_shape_choice_from_drawtype(value) {
    let v = String(value || '').toLowerCase();
    if (v === 'json') return 'preset';
    if (v === 'cube') return 'cube';
    if (v === 'cross') return 'cross';
    if (v === 'empty') return 'empty';
    if (v === 'slab' || v === 'stairs' || v === 'custom' || v === 'current' || v === 'preset') return v;
    return 'preset';
}

function vs_wizard_basic_shape_base(choice) {
    choice = String(choice || '').toLowerCase();
    if (choice === 'slab') return 'game:block/basic/slab/slab-down';
    if (choice === 'stairs') return 'game:block/basic/stairs/planks-free-up';
    return '';
}

function vs_wizard_collision_for_shape(choice, preset_drawtype, preset_collision) {
    choice = String(choice || '').toLowerCase();
    if (choice === 'preset') {
        if (preset_collision && preset_collision !== 'custom') return preset_collision;
        return vs_wizard_collision_for_shape(preset_drawtype || 'cube', '', '');
    }
    if (choice === 'slab' || choice === 'stairs') return 'lower_slab';
    if (choice === 'cross') return 'plant';
    if (choice === 'empty') return 'none';
    return 'full';
}

function vs_wizard_box_for_preset(preset) {
    if (preset === 'none') return null;
    if (preset === 'lower_slab') return { x1: 0, y1: 0, z1: 0, x2: 1, y2: 0.5, z2: 1 };
    if (preset === 'carpet') return { x1: 0, y1: 0, z1: 0, x2: 1, y2: 0.0625, z2: 1 };
    if (preset === 'plant') return { x1: 0.25, y1: 0, z1: 0.25, x2: 0.75, y2: 0.875, z2: 0.75 };
    return undefined;
}

function vs_wizard_value_or_custom(value, custom_value) {
    if (value === 'custom') return String(custom_value || '').trim();
    return String(value || '').trim();
}

function vs_wizard_sound_ref(value) {
    value = String(value || '').trim().replace(/\\/g, '/');
    if (!value) return '';
    if (/^[a-z0-9_.-]+:/i.test(value)) return value;
    return 'game:' + value.replace(/^\/+/, '');
}

function vs_wizard_face_bool_form_value(value) {
    if (value === true || value === false) return String(value);
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.all === 'boolean') return String(value.all);
    return '';
}

function vs_wizard_write_blank_texture(fs_mod, file_path, width, height) {
    let b64 = '';
    try {
        let canvas = document.createElement('canvas');
        width = Math.max(1, parseInt(width || Project.texture_width || 16, 10));
        height = Math.max(1, parseInt(height || Project.texture_height || 16, 10));
        canvas.width = width;
        canvas.height = height;
        let ctx = canvas.getContext('2d');
        ctx.fillStyle = '#b8b8b8';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#8f8f8f';
        ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.moveTo(width / 2, 1);
        ctx.lineTo(width / 2, height - 1);
        ctx.moveTo(1, height / 2);
        ctx.lineTo(width - 1, height / 2);
        ctx.stroke();
        b64 = canvas.toDataURL('image/png').split(',')[1];
    } catch (_) {}
    fs_mod.writeFileSync(file_path, Buffer.from(b64 || VS_WIZARD_PLACEHOLDER_PNG_B64, 'base64'));
}

function vs_wizard_drawtype_to_form(value) {
    let v = String(value || '').toLowerCase();
    if (v === 'json') return 'preset';
    if (v === 'cross') return 'cross';
    if (v === 'empty') return 'empty';
    return 'cube';
}

function vs_wizard_clean_texture_ref(ref) {
    ref = String(ref || '').trim().replace(/\.png$/i, '');
    if (!ref || /[{}*]/.test(ref)) return '';
    let colon = ref.indexOf(':');
    if (colon >= 0) ref = ref.slice(colon + 1);
    return ref.replace(/\\/g, '/');
}

function vs_wizard_generated_texture_ref(mod_id, texture_basename) {
    return mod_id + ':block/' + texture_basename;
}

function vs_wizard_normalize_generated_texture_refs(value, mod_id, texture_basename) {
    if (typeof value === 'string') {
        let normalized = value.replace(/\\/g, '/').replace(/\.png$/i, '');
        let local_prefix = mod_id + ':';
        if (normalized === texture_basename || normalized === local_prefix + texture_basename || normalized === local_prefix + 'textures/' + texture_basename) {
            return vs_wizard_generated_texture_ref(mod_id, texture_basename);
        }
        return value;
    }
    if (Array.isArray(value)) return value.map(v => vs_wizard_normalize_generated_texture_refs(v, mod_id, texture_basename));
    if (!value || typeof value !== 'object') return value;
    let out = {};
    Object.keys(value).forEach(key => {
        out[key] = vs_wizard_normalize_generated_texture_refs(value[key], mod_id, texture_basename);
    });
    return out;
}

function vs_wizard_normalize_blocktype_face_bools(block_json) {
    ['sideopaque', 'sidesolid'].forEach(key => {
        if (block_json[key] === true || block_json[key] === false) block_json[key] = { all: block_json[key] };
    });
    return block_json;
}

function vs_wizard_texture_keys(value) {
    let keys = String(value || 'all').split(',').map(k => k.trim()).filter(Boolean);
    return keys.length ? keys : ['all'];
}

function vs_wizard_find_texture_ref(node) {
    if (!node) return '';
    if (typeof node === 'string') return vs_wizard_clean_texture_ref(node);
    if (typeof node !== 'object') return '';
    if (typeof node.base === 'string') return vs_wizard_clean_texture_ref(node.base);
    let preferred = ['all', 'up', 'top', 'side', 'north', 'east', 'south', 'west', 'down', 'base'];
    for (let i = 0; i < preferred.length; i++) {
        let found = vs_wizard_find_texture_ref(node[preferred[i]]);
        if (found) return found;
    }
    for (let key in node) {
        let found = vs_wizard_find_texture_ref(node[key]);
        if (found) return found;
    }
    return '';
}

function vs_wizard_shape_rel_from_base(base) {
    let rel = String(base || '').trim().replace(/\\/g, '/');
    if (!rel) return '';
    let colon_index = rel.indexOf(':');
    if (colon_index >= 0) rel = rel.slice(colon_index + 1);
    rel = rel.replace(/^shapes\//i, '').replace(/^assets\/[^/]+\/shapes\//i, '');
    rel = rel.replace(/\.json$/i, '');
    if (!rel) return '';
    return rel + '.json';
}

function vs_wizard_shape_candidates(path_mod, rel_shape_path) {
    let root = get_assets_root();
    if (!root || !rel_shape_path) return [];
    return [
        path_mod.join(root, 'survival', 'shapes', rel_shape_path),
        path_mod.join(root, 'game', 'shapes', rel_shape_path),
        path_mod.join(root, 'assets', 'survival', 'shapes', rel_shape_path),
        path_mod.join(root, 'assets', 'game', 'shapes', rel_shape_path),
        path_mod.join(root, rel_shape_path)
    ];
}

function vs_wizard_read_shape_from_base(path_mod, fs_mod, base) {
    let rel_shape_path = vs_wizard_shape_rel_from_base(base);
    let candidates = vs_wizard_shape_candidates(path_mod, rel_shape_path);
    for (let candidate_index = 0; candidate_index < candidates.length; candidate_index++) {
        try {
            if (fs_mod.existsSync(candidates[candidate_index])) {
                return {
                    rel: rel_shape_path,
                    path: candidates[candidate_index],
                    json: parse_vs_json(fs_mod.readFileSync(candidates[candidate_index], 'utf8'))
                };
            }
        } catch (shape_error) {
            console.warn('[vs_wizard] failed to read shape preset ' + candidates[candidate_index], shape_error);
        }
    }
    return null;
}

function vs_wizard_collect_shape_texture_keys(shape) {
    let keys = new Set();
    if (shape && shape.textures && typeof shape.textures === 'object') {
        Object.keys(shape.textures).forEach(texture_key => {
            if (texture_key && texture_key !== 'null') keys.add(texture_key);
        });
    }

    function walk(element) {
        if (!element || typeof element !== 'object') return;
        if (element.faces && typeof element.faces === 'object') {
            FACE_KEYS.forEach(face_key => {
                let face = element.faces[face_key];
                if (!face || face.enabled === false || !face.texture) return;
                let texture_key = String(face.texture).replace(/^#/, '');
                if (texture_key && texture_key !== 'null') keys.add(texture_key);
            });
        }
        if (Array.isArray(element.children)) element.children.forEach(walk);
    }

    if (shape && Array.isArray(shape.elements)) shape.elements.forEach(walk);
    return Array.from(keys);
}

function vs_wizard_prepare_custom_shape_for_export(shape_data, texture_basename, texture_size) {
    let shape_json = null;
    if (typeof shape_data === 'string') {
        try { shape_json = parse_vs_json(shape_data); } catch (_) { shape_json = null; }
    } else if (shape_data && typeof shape_data === 'object') {
        shape_json = vs_wizard_clone_json(shape_data);
    }
    if (!shape_json || typeof shape_json !== 'object') {
        return { text: typeof shape_data === 'string' ? shape_data : JSON.stringify(shape_data, null, 2), texture_keys: [] };
    }
    let texture_keys = vs_wizard_collect_shape_texture_keys(shape_json);
    if (!shape_json.textures || typeof shape_json.textures !== 'object' || Array.isArray(shape_json.textures)) shape_json.textures = {};
    texture_keys.forEach(texture_key => {
        if (texture_key && texture_key !== 'null') shape_json.textures[texture_key] = 'block/' + texture_basename;
    });
    if (texture_size && texture_size.width && texture_size.height) {
        if (!shape_json.textureWidth) shape_json.textureWidth = texture_size.width;
        if (!shape_json.textureHeight) shape_json.textureHeight = texture_size.height;
        if (!shape_json.textureSizes || typeof shape_json.textureSizes !== 'object' || Array.isArray(shape_json.textureSizes)) shape_json.textureSizes = {};
        let key_width = shape_json.textureWidth || texture_size.width;
        let key_height = shape_json.textureHeight || texture_size.height;
        texture_keys.forEach(texture_key => {
            if (texture_key && texture_key !== 'null') shape_json.textureSizes[texture_key] = [key_width, key_height];
        });
    }
    return { text: JSON.stringify(shape_json, null, 2), texture_keys: texture_keys };
}

function vs_wizard_make_cube_shape(texture_key) {
    texture_key = texture_key || 'all';
    let face = { texture: '#' + texture_key, uv: [0, 0, 16, 16] };
    return {
        textureWidth: 16,
        textureHeight: 16,
        textures: {},
        elements: [{
            name: 'Cube',
            from: [0, 0, 0],
            to: [16, 16, 16],
            faces: { north: face, east: face, south: face, west: face, up: face, down: face }
        }]
    };
}

function vs_wizard_pattern_matches(pattern, actual_code) {
    pattern = String(pattern || '');
    actual_code = String(actual_code || '');
    if (!pattern || !actual_code) return false;
    if (pattern === actual_code) return true;
    let escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    try { return new RegExp('^' + escaped + '$').test(actual_code); }
    catch (_) { return false; }
}
function vs_wizard_match_by_type(map, actual_code) {
    if (!map || typeof map !== 'object' || !actual_code) return undefined;
    if (Object.prototype.hasOwnProperty.call(map, actual_code)) return map[actual_code];
    let best_key = '';
    let best_score = -1;
    Object.keys(map).forEach(pattern => {
        if (!vs_wizard_pattern_matches(pattern, actual_code)) return;
        let literal_length = pattern.replace(/\*/g, '').length;
        let star_count = (pattern.match(/\*/g) || []).length;
        let score = literal_length * 10 - star_count;
        if (score > best_score) {
            best_key = pattern;
            best_score = score;
        }
    });
    return best_key ? map[best_key] : undefined;
}

function vs_wizard_apply_descriptor_vars(ref, desc) {
    let vars = (desc && desc.vars) || {};
    return String(ref || '').replace(/\{([^}]+)\}/g, (match, key) => {
        return vars[key] !== undefined ? String(vars[key]) : match;
    });
}

function vs_wizard_resolve_descriptor_vars(value, desc) {
    if (typeof value === 'string') return vs_wizard_apply_descriptor_vars(value, desc || {});
    if (Array.isArray(value)) return value.map(entry => vs_wizard_resolve_descriptor_vars(entry, desc));
    if (!value || typeof value !== 'object') return value;
    let out = {};
    Object.keys(value).forEach(key => {
        out[key] = vs_wizard_resolve_descriptor_vars(value[key], desc);
    });
    return out;
}

function vs_wizard_texture_ref_from_node(node, desc) {
    let ref = '';
    if (!node) return '';
    if (typeof node === 'string') ref = node;
    else if (typeof node === 'object' && typeof node.base === 'string') ref = node.base;
    else return vs_wizard_find_texture_ref(node);
    ref = vs_wizard_apply_descriptor_vars(ref, desc || {});
    return vs_wizard_clean_texture_ref(ref);
}

function vs_wizard_assign_texture_map(target, source, desc) {
    if (!source || typeof source !== 'object') return;
    Object.keys(source).forEach(texture_key => {
        let ref = vs_wizard_texture_ref_from_node(source[texture_key], desc);
        if (ref) target[texture_key] = ref;
    });
}

function vs_wizard_preview_texture_map(data, desc, shape, values) {
    let texture_map = {};
    let tinted_keys = new Set();
    let shape_keys = vs_wizard_collect_shape_texture_keys(shape);
    let actual_code = desc.actual_code || '';

    vs_wizard_assign_texture_map(texture_map, data && data.textures, desc);
    let typed_textures = vs_wizard_match_by_type(data && data.texturesByType, actual_code);
    vs_wizard_assign_texture_map(texture_map, typed_textures, desc);
    vs_wizard_assign_texture_map(texture_map, desc.textures, desc);
    vs_wizard_assign_texture_map(texture_map, desc.preview_textures, desc);

    let descriptor_texture = vs_wizard_texture_ref_from_node(desc.texture, desc);
    if (descriptor_texture) {
        let descriptor_keys = desc.texture_key ? vs_wizard_texture_keys(desc.texture_key) : (shape_keys.length ? shape_keys : ['all']);
        descriptor_keys.forEach(texture_key => { texture_map[texture_key] = descriptor_texture; });
        if (!texture_map.all) texture_map.all = descriptor_texture;
    }

    if (texture_map.all) {
        shape_keys.forEach(texture_key => {
            if (!texture_map[texture_key]) texture_map[texture_key] = texture_map.all;
        });
    }

    if (shape && shape.textures && typeof shape.textures === 'object') {
        Object.keys(shape.textures).forEach(texture_key => {
            if (!texture_map[texture_key]) {
                let ref = vs_wizard_texture_ref_from_node(shape.textures[texture_key], desc);
                if (ref) texture_map[texture_key] = ref;
            }
        });
    }

    if (Array.isArray(desc.tinted_keys)) {
        desc.tinted_keys.forEach(texture_key => tinted_keys.add(texture_key));
    }
    let climate_map = desc.climate_color_map || (data && data.climateColorMap) || vs_wizard_match_by_type(data && data.climateColorMapByType, actual_code);
    if (climate_map) {
        shape_keys.forEach(texture_key => {
            if (!/petal|flower/i.test(texture_key)) tinted_keys.add(texture_key);
        });
    }
    if (values && values.climate_color_map) {
        shape_keys.forEach(texture_key => {
            if (!/petal|flower/i.test(texture_key)) tinted_keys.add(texture_key);
        });
    }

    return { textures: texture_map, tinted_keys: Array.from(tinted_keys) };
}

function vs_wizard_extra_fields_from_blocktype(data) {
    let guided = new Set([
        'code', 'creativeinventory', 'drawtype', 'textures', 'texturesByType', 'shape',
        'blockmaterial', 'resistance', 'minMiningTier', 'requiredMiningTier', 'requiredminingtier', 'materialDensity',
        'replaceable', 'fertility', 'sideopaque', 'sidesolid', 'frostable', 'faceCullMode',
        'climateColorMap', 'seasonColorMap', 'class', 'entityClass', 'entityBehaviors', 'entityBehavior', 'collisionbox', 'selectionbox',
        'drops', 'behaviors', 'attributes', 'variantgroups', 'combustibleProps', 'particleProperties',
        'sounds', 'renderpass', 'lightAbsorption', 'lightValue', 'lightHsv', 'randomDrawOffset',
        'walkspeedmultiplier', 'dragMultiplier'
    ]);
    let extra = {};
    Object.keys(data || {}).forEach(key => {
        if (!guided.has(key)) extra[key] = vs_wizard_clone_json(data[key]);
    });
    return Object.keys(extra).length ? extra : null;
}

function vs_wizard_blocktype_candidates(path_mod, rel) {
    let root = get_assets_root();
    if (!root) return [];
    return [
        path_mod.join(root, 'survival', 'blocktypes', rel),
        path_mod.join(root, 'game', 'blocktypes', rel),
        path_mod.join(root, 'assets', 'survival', 'blocktypes', rel),
        path_mod.join(root, 'assets', 'game', 'blocktypes', rel),
        path_mod.join(root, 'blocktypes', rel)
    ];
}

function vs_wizard_read_blocktype(path_mod, fs_mod, rel) {
    let candidates = vs_wizard_blocktype_candidates(path_mod, rel);
    for (let i = 0; i < candidates.length; i++) {
        try {
            if (fs_mod.existsSync(candidates[i])) {
                return parse_vs_json(fs_mod.readFileSync(candidates[i], 'utf8'));
            }
        } catch (e) {
            console.warn('[vs_wizard] failed to read blocktype preset ' + candidates[i], e);
        }
    }
    return null;
}

function vs_wizard_form_values_from_blocktype(data, desc) {
    let source_domain = vs_wizard_runtime_asset_domain(desc.domain || 'game');
    let simple_preset = !!desc.simple;
    let creative_keys = data.creativeinventory && typeof data.creativeinventory === 'object' ? Object.keys(data.creativeinventory) : [];
    let known_tabs = ['general', 'flora', 'terrain', 'decorative', 'clutter', 'construction', 'mechanics', 'aquatic', 'items', 'liquids', 'tools', 'clothing', 'creatures', 'special'];
    let renderpasses = ['', 'Opaque', 'OpaqueNoCull', 'Transparent', 'TopSoil', 'Liquid', 'Meta'];
    let climate_maps = ['', 'climatePlantTint', 'climateWaterTint'];
    let season_maps = ['', 'seasonFoliage', 'seasonGrass'];
    let values = {
        block_code: desc.default_code || 'myblock',
        block_display_name: desc.default_display || 'My Block',
        creative_tabs: desc.creative_tab || (creative_keys.length ? (known_tabs.indexOf(creative_keys[0]) >= 0 ? creative_keys[0] : 'custom') : 'general'),
        creative_tabs_extra: desc.creative_tab ? '' : (creative_keys.length > 1 ? creative_keys.slice(1).join(',') : (creative_keys.length && known_tabs.indexOf(creative_keys[0]) < 0 ? creative_keys[0] : '')),
        texture_mode: desc.texture_mode || (desc.textures ? 'source' : 'single'),
        texture_base: '__preset__',
        preset_texture_path: desc.texture || vs_wizard_find_texture_ref(desc.textures) || vs_wizard_find_texture_ref(data.textures) || vs_wizard_find_texture_ref(data.texturesByType),
        texture_key: desc.texture_key || (desc.textures ? Object.keys(desc.textures).join(',') : 'all'),
        drawtype: desc.drawtype || vs_wizard_drawtype_to_form(data.drawtype || (data.shape ? 'json' : 'cube')),
        use_current_shape: false
    };
    if (desc.renderpass) values.renderpass = desc.renderpass;
    if (desc.blockmaterial || typeof data.blockmaterial === 'string') values.blockmaterial = desc.blockmaterial || data.blockmaterial;
    if (desc.resistance !== undefined || data.resistance !== undefined) values.resistance = desc.resistance !== undefined ? desc.resistance : data.resistance;
    if (desc.required_mining_tier !== undefined) values.required_mining_tier = desc.required_mining_tier;
    else if (data.minMiningTier !== undefined) values.required_mining_tier = data.minMiningTier;
    else if (data.requiredMiningTier !== undefined) values.required_mining_tier = data.requiredMiningTier;
    else if (data.requiredminingtier !== undefined) values.required_mining_tier = data.requiredminingtier;
    if (desc.textures) {
        values.textures_json = vs_wizard_json_text(vs_wizard_prefix_base_refs(vs_wizard_resolve_descriptor_vars(desc.textures, desc), source_domain));
    } else if (desc.texture) {
        let texture_json = {};
        vs_wizard_texture_keys(desc.texture_key || 'all').forEach(key => {
            texture_json[key] = { base: vs_wizard_domain_ref(vs_wizard_apply_descriptor_vars(desc.texture, desc), source_domain) };
        });
        values.textures_json = vs_wizard_json_text(texture_json);
    } else if (data.textures !== undefined) values.textures_json = vs_wizard_json_text(vs_wizard_prefix_base_refs(data.textures, source_domain));
    if (!simple_preset && data.texturesByType !== undefined) values.texturesbytype_json = vs_wizard_json_text(vs_wizard_prefix_base_refs(data.texturesByType, source_domain));
    if (desc.shape) {
        values.shape_base = vs_wizard_domain_ref(desc.shape, source_domain);
    } else if (data.shape !== undefined) {
        values.shape_base = vs_wizard_domain_ref(vs_wizard_shape_base(data.shape), source_domain);
        if (!values.shape_base) values.shape_json = vs_wizard_json_text(vs_wizard_prefix_base_refs(data.shape, source_domain));
    }
    if (data.renderpass) {
        values.renderpass = vs_wizard_known_or_custom(data.renderpass, renderpasses);
        if (values.renderpass === 'custom') values.renderpass_custom = data.renderpass;
    }
    if (data.lightAbsorption !== undefined) values.light_absorption = data.lightAbsorption;
    if (data.lightValue !== undefined) values.light_brightness = data.lightValue;
    if (data.lightHsv !== undefined) values.light_hsv_json = vs_wizard_json_text(data.lightHsv);
    if (data.replaceable !== undefined) values.replaceable = data.replaceable;
    if (data.fertility !== undefined) values.fertility = data.fertility;
    if (data.materialDensity !== undefined) values.material_density = data.materialDensity;
    if (data.sideopaque !== undefined) values.sideopaque = vs_wizard_face_bool_form_value(data.sideopaque);
    if (data.sidesolid !== undefined) values.sidesolid = vs_wizard_face_bool_form_value(data.sidesolid);
    if (data.frostable !== undefined) values.frostable = String(!!data.frostable);
    if (data.faceCullMode) values.face_cull_mode = data.faceCullMode;
    if (data.collisionbox !== undefined) values.collisionbox_preset = vs_wizard_box_preset_from_value(data.collisionbox);
    if (data.selectionbox !== undefined) values.selectionbox_preset = vs_wizard_box_preset_from_value(data.selectionbox);
    if (data.randomDrawOffset !== undefined) values.random_draw_offset = !!data.randomDrawOffset;
    if (data.dragMultiplier !== undefined) values.movement_preset = 'slippery';
    else if (data.walkspeedmultiplier !== undefined && data.walkspeedmultiplier <= 0.3) values.movement_preset = 'web';
    else if (data.walkspeedmultiplier !== undefined && data.walkspeedmultiplier < 1) values.movement_preset = 'slow';
    if (data.climateColorMap) {
        values.climate_color_map = vs_wizard_known_or_custom(data.climateColorMap, climate_maps);
        if (values.climate_color_map === 'custom') values.climate_color_map_custom = data.climateColorMap;
    }
    if (desc.climate_color_map) {
        values.climate_color_map = vs_wizard_known_or_custom(desc.climate_color_map, climate_maps);
        if (values.climate_color_map === 'custom') values.climate_color_map_custom = desc.climate_color_map;
    }
    if (data.seasonColorMap) {
        values.season_color_map = vs_wizard_known_or_custom(data.seasonColorMap, season_maps);
        if (values.season_color_map === 'custom') values.season_color_map_custom = data.seasonColorMap;
    }
    if (desc.season_color_map) {
        values.season_color_map = vs_wizard_known_or_custom(desc.season_color_map, season_maps);
        if (values.season_color_map === 'custom') values.season_color_map_custom = desc.season_color_map;
    }
    if (!simple_preset && data.class) values.block_class = data.class;
    if (!simple_preset && data.entityClass) values.entity_class = data.entityClass;
    if (data.collisionbox !== undefined) values.collisionbox_json = vs_wizard_json_text(data.collisionbox);
    if (data.selectionbox !== undefined) values.selectionbox_json = vs_wizard_json_text(data.selectionbox);
    if (data.drops !== undefined && !simple_preset) values.drops_json = vs_wizard_json_text(data.drops);
    if (data.behaviors !== undefined && !simple_preset) values.behaviors_json = vs_wizard_json_text(data.behaviors);
    if (data.attributes !== undefined && !simple_preset) values.attributes_json = vs_wizard_json_text(data.attributes);
    if (!simple_preset && data.variantgroups !== undefined) values.variantgroups_json = vs_wizard_json_text(data.variantgroups);
    if (data.combustibleProps !== undefined) {
        values.combustible_preset = 'custom';
        values.combustibleprops_json = vs_wizard_json_text(data.combustibleProps);
    }
    if (data.particleProperties !== undefined) values.particleproperties_json = vs_wizard_json_text(data.particleProperties);
    if (data.sounds && typeof data.sounds === 'object') {
        ['place', 'walk', 'break', 'hit'].forEach(k => {
            if (typeof data.sounds[k] === 'string') values['sound_' + k] = data.sounds[k];
        });
    }
    let extra = vs_wizard_extra_fields_from_blocktype(data);
    if (simple_preset && extra) {
        extra = vs_wizard_strip_template_fields(extra);
        if (!Object.keys(extra || {}).length) extra = null;
    }
    if (extra) values.extra_json = vs_wizard_json_text(extra);
    return values;
}

function build_vs_asset_block_presets(path_mod, fs_mod) {
    if (!get_assets_root()) return [];
    let presets = [];
    VS_ASSET_BLOCK_PRESET_DESCRIPTORS.forEach(desc => {
        let data = vs_wizard_read_blocktype(path_mod, fs_mod, desc.rel);
        if (!data) return;
        let values = vs_wizard_form_values_from_blocktype(data, desc);
        let preview_url = values.preset_texture_path ? load_vs_texture_data(values.preset_texture_path + '.png') : '';
        let shape_info = values.shape_base ? vs_wizard_read_shape_from_base(path_mod, fs_mod, values.shape_base) : null;
        if (!shape_info && values.drawtype === 'Cross') shape_info = vs_wizard_read_shape_from_base(path_mod, fs_mod, 'survival:block/basic/cross');
        let preview_shape = shape_info && shape_info.json ? shape_info.json : vs_wizard_make_cube_shape(vs_wizard_texture_keys(values.texture_key || 'all')[0] || 'all');
        let preview_map = vs_wizard_preview_texture_map(data, desc, preview_shape, values);
        presets.push({
            id: desc.id,
            name: desc.name,
            icon: desc.icon,
            preview_url: preview_url,
            preview_shape: preview_shape,
            preview_textures: preview_map.textures,
            preview_tinted_keys: preview_map.tinted_keys,
            render: desc.render || (values.drawtype === 'Cross' ? 'cross' : 'cube'),
            desc: desc.actual_code || desc.rel,
            source: 'VS Assets',
            apply: () => vs_wizard_clone_json(values)
        });
    });
    return presets;
}

function build_vs_wizard_stepper(pages) {
    let root = document.createElement('div');
    root.className = 'vs-wizard-stepper';
    root.style.cssText = 'padding:8px 10px 10px;border-bottom:1px solid var(--color-border);margin-bottom:8px;';

    let line = document.createElement('div');
    line.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;';
    let title = document.createElement('div');
    title.style.cssText = 'font-weight:700;color:var(--color-accent);font-size:1.05em;';
    let count = document.createElement('div');
    count.style.cssText = 'opacity:0.7;font-size:0.86em;white-space:nowrap;';
    line.append(title, count);
    root.append(line);

    let dots = document.createElement('div');
    dots.style.cssText = 'display:grid;grid-template-columns:repeat(' + pages.length + ',1fr);gap:4px;';
    let nodes = pages.map(page => {
        let dot = document.createElement('div');
        dot.title = page.label;
        dot.style.cssText = 'height:5px;border-radius:3px;background:var(--color-button);opacity:0.65;';
        dots.append(dot);
        return dot;
    });
    root.append(dots);

    return {
        root,
        update(index) {
            title.textContent = pages[index].label;
            count.textContent = 'Step ' + (index + 1) + ' of ' + pages.length;
            nodes.forEach((dot, i) => {
                dot.style.background = i <= index ? 'var(--color-accent)' : 'var(--color-button)';
                dot.style.opacity = i <= index ? '1' : '0.65';
            });
        }
    };
}

function open_vs_block_wizard(path_mod, fs_mod) {
    // current project defaults
    let texture_options = {
        __preset__: 'Preset texture',
        __blank__: 'Custom blank 32x32 texture'
    };
    Texture.all.forEach(t => { texture_options[t.uuid] = t.name || ('texture_' + t.uuid.slice(0, 6)); });

    let default_tex = Texture.getDefault();
    let default_tex_uuid = default_tex ? default_tex.uuid : '__blank__';
    let has_vs_model = is_vs_format() && Outliner.root.some(n => n instanceof Group || n instanceof Cube);
    let default_out = vs_wizard_default_mods_folder(path_mod);
    let export_state = {
        mode: 'new_mod',
        existing_mod_path: '',
        existing_mod: null,
        existing_mods: vs_wizard_existing_mods(path_mod, fs_mod, default_out),
        mod_icon_source: vs_wizard_default_mod_icon_source(path_mod, fs_mod)
    };
    let last_export_result = null;
    let dialog_object = null;
    let pages = [
        { id: 'preset', label: 'Preset', icon: 'view_module' },
        { id: 'block', label: 'Naming', icon: 'description' },
        { id: 'appearance', label: 'Appearance', icon: 'palette' },
        { id: 'properties', label: 'Properties', icon: 'tune' },
        { id: 'world', label: 'World Rules', icon: 'public' },
        { id: 'drops', label: 'Drops', icon: 'system_update_alt' },
        { id: 'sounds', label: 'Sounds', icon: 'volume_up' },
        { id: 'advanced', label: 'Advanced JSON', icon: 'data_object' },
        { id: 'export', label: 'Export', icon: 'save' },
        { id: 'next_steps', label: 'Next Steps', icon: 'queue_play_next' }
    ];
    let current_page = 'preset';
    let current_page_index = 0;
    let on_page = (key) => () => current_page === key;
    let on_export_new = () => current_page === 'export' && export_state.mode === 'new_mod';
    let on_export_integrate = () => current_page === 'export' && export_state.mode === 'integrate';
    let stepper = build_vs_wizard_stepper(pages);
    let dialog = null;
    let nav_buttons = null;
    let sidebar_switching = false;
    let selected_preset_id = '';
    let selected_preset_texture_path = '';
    let selected_preset_shape_base = '';
    let selected_preset_shape_json = '';
    let selected_preset_drawtype = 'cube';
    let selected_preset_collisionbox = 'full';
    let shape_choice_state = 'preset';
    let collision_choice_state = 'match';
    let selection_choice_state = 'same';
    let dynamic_form_refresh = false;

    let on_shape_custom = () => current_page === 'appearance' && shape_choice_state === 'custom';
    let on_collision_custom = () => current_page === 'world' && collision_choice_state === 'custom';
    let on_selection_custom = () => current_page === 'world' && selection_choice_state === 'custom';

    function update_dynamic_form_state(form) {
        form = form || {};
        let next_shape = vs_wizard_shape_choice_from_drawtype(form.drawtype || shape_choice_state || 'preset');
        let next_collision = String(form.collisionbox_preset || collision_choice_state || 'match');
        let next_selection = String(form.selectionbox_preset || selection_choice_state || 'same');
        let changed = next_shape !== shape_choice_state || next_collision !== collision_choice_state || next_selection !== selection_choice_state;
        shape_choice_state = next_shape;
        collision_choice_state = next_collision;
        selection_choice_state = next_selection;
        if (changed && dialog && dialog.form && !dynamic_form_refresh) {
            dynamic_form_refresh = true;
            dialog.form.updateValues({ cause: 'shape_controls' });
            dynamic_form_refresh = false;
        }
    }

    function set_export_mode(mode) {
        export_state.mode = mode === 'integrate' ? 'integrate' : 'new_mod';
        if (export_panel && export_panel.update) export_panel.update();
        if (dialog && dialog.form) dialog.form.updateValues({ cause: 'export_mode' });
    }

    function select_existing_mod(mod_entry) {
        export_state.existing_mod = mod_entry || null;
        export_state.existing_mod_path = mod_entry ? mod_entry.path : '';
        if (dialog && dialog.setFormValues) dialog.setFormValues({ existing_mod_folder: export_state.existing_mod_path }, true);
        if (export_panel && export_panel.update) export_panel.update();
    }
    function scroll_dialog_to_top() {
        if (!dialog_object) return;
        setTimeout(() => {
            let nodes = [dialog_object, dialog_object.querySelector('content'), dialog_object.querySelector('.dialog_content'), dialog_object.querySelector('.form_bar')];
            nodes.forEach(node => { if (node && typeof node.scrollTop === 'number') node.scrollTop = 0; });
        }, 0);
    }

    function build_export_panel() {
        let root = document.createElement('div');
        root.style.cssText = 'display:none;padding:4px 6px 14px;';

        let intro = document.createElement('div');
        intro.style.cssText = 'padding:0 0 10px;opacity:0.86;line-height:1.35;';
        intro.textContent = 'Choose whether this block starts a new Vintage Story content mod or gets added to an existing unzipped mod folder.';
        root.append(intro);

        let cards = document.createElement('div');
        cards.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin-bottom:14px;';
        root.append(cards);
        let card_nodes = {};
        function make_card(mode, title, desc, icon, color) {
            let card = document.createElement('div');
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.style.cssText = 'text-align:left;min-height:136px;padding:14px 14px 16px;border:1px solid transparent;border-bottom:8px solid ' + color + ';border-radius:5px;background:var(--color-back);color:inherit;cursor:pointer;box-sizing:border-box;overflow:hidden;';
            let head = document.createElement('div');
            head.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:1.2em;font-weight:600;margin-bottom:8px;line-height:1.2;';
            try { head.append(Blockbench.getIconNode(icon)); } catch (_) {}
            let label = document.createElement('span');
            label.textContent = title;
            head.append(label);
            card.append(head);
            let body = document.createElement('div');
            body.style.cssText = 'opacity:0.74;line-height:1.32;overflow-wrap:anywhere;';
            body.textContent = desc;
            card.append(body);
            card.addEventListener('click', () => set_export_mode(mode));
            card.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    set_export_mode(mode);
                }
            });
            card_nodes[mode] = card;
            cards.append(card);
        }
        make_card('new_mod', 'Export New Mod', 'Make a new mod folder with the files Vintage Story needs for this block.', 'create_new_folder', '#dccb92');
        make_card('integrate', 'Integrate Existing Mod', 'Add this block to an existing unzipped mod without changing its modinfo.', 'library_add', '#83c4ea');

        let integrate_box = document.createElement('div');
        integrate_box.style.cssText = 'display:none;margin:0 0 14px;';
        let integrate_title = document.createElement('div');
        integrate_title.style.cssText = 'font-weight:600;margin:0 0 6px;';
        integrate_title.textContent = 'Existing Mods';
        integrate_box.append(integrate_title);
        let list = document.createElement('div');
        list.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:6px;';
        integrate_box.append(list);
        root.append(integrate_box);

        function make_mod_row(mod_entry) {
            let row = document.createElement('button');
            row.type = 'button';
            row.style.cssText = 'display:flex;align-items:center;gap:8px;min-height:42px;padding:5px 7px;border:1px solid transparent;border-radius:5px;background:var(--color-back);color:inherit;text-align:left;cursor:pointer;overflow:hidden;';
            let icon = document.createElement('div');
            icon.style.cssText = 'width:32px;height:32px;flex:0 0 32px;border-radius:3px;background:var(--color-ui);background-size:cover;background-position:center;image-rendering:auto;';
            if (mod_entry.icon_url) icon.style.backgroundImage = 'url("' + mod_entry.icon_url + '")';
            row.append(icon);
            let text = document.createElement('div');
            text.style.cssText = 'min-width:0;line-height:1.15;';
            let name = document.createElement('div');
            name.textContent = mod_entry.name;
            name.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;';
            let id = document.createElement('div');
            id.textContent = mod_entry.id;
            id.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0.62;font-size:0.82em;';
            text.append(name, id);
            row.append(text);
            row.addEventListener('click', () => select_existing_mod(mod_entry));
            row.__vs_mod_entry = mod_entry;
            return row;
        }

        function rebuild_mod_list() {
            list.innerHTML = '';
            export_state.existing_mods.forEach(mod_entry => list.append(make_mod_row(mod_entry)));
            let manual = document.createElement('button');
            manual.type = 'button';
            manual.style.cssText = 'display:flex;align-items:center;gap:8px;min-height:42px;padding:5px 7px;border:1px dashed var(--color-border);border-radius:5px;background:transparent;color:inherit;text-align:left;cursor:pointer;';
            try { manual.append(Blockbench.getIconNode('add')); } catch (_) {}
            let label = document.createElement('span');
            label.textContent = 'Select mod folder manually...';
            manual.append(label);
            manual.addEventListener('click', () => {
                let picked = '';
                try { picked = Blockbench.pickDirectory({ resource_id: 'vintagestory_existing_mod' }); } catch (_) {}
                if (!picked) return;
                let mod_entry = vs_wizard_mod_entry_from_folder(path_mod, fs_mod, picked);
                export_state.existing_mods = export_state.existing_mods.filter(entry => entry.path !== mod_entry.path);
                export_state.existing_mods.push(mod_entry);
                export_state.existing_mods.sort((a, b) => a.name.localeCompare(b.name));
                rebuild_mod_list();
                select_existing_mod(mod_entry);
            });
            list.append(manual);
        }
        rebuild_mod_list();

        let icon_box = document.createElement('div');
        icon_box.style.cssText = 'display:flex;align-items:center;gap:10px;margin:0 0 8px;padding:10px;border:1px solid var(--color-border);border-radius:5px;background:rgba(0,0,0,0.12);';
        let icon_preview = document.createElement('div');
        icon_preview.style.cssText = 'width:56px;height:56px;flex:0 0 56px;background:var(--color-back);border-radius:4px;background-size:cover;background-position:center;image-rendering:auto;';
        icon_box.append(icon_preview);
        let icon_text = document.createElement('div');
        icon_text.style.cssText = 'min-width:0;';
        let icon_label = document.createElement('div');
        icon_label.textContent = 'Mod Icon';
        icon_label.style.cssText = 'font-weight:600;margin-bottom:4px;';
        let icon_desc = document.createElement('div');
        icon_desc.textContent = 'Uses the Vintage Story default mod icon unless you choose a PNG.';
        icon_desc.style.cssText = 'opacity:0.72;margin-bottom:7px;line-height:1.25;';
        let icon_button = document.createElement('button');
        icon_button.type = 'button';
        icon_button.style.cssText = 'display:inline-flex;align-items:center;gap:5px;';
        try { icon_button.append(Blockbench.getIconNode('folder')); } catch (_) {}
        let icon_button_text = document.createElement('span');
        icon_button.append(icon_button_text);
        icon_button.addEventListener('click', () => {
            Blockbench.import({ readtype: 'image', type: 'Image', extensions: ['png'] }, files => {
                let file = files && files[0];
                if (!file) return;
                export_state.mod_icon_source = file.content || file.path || '';
                root.update();
            });
        });
        icon_text.append(icon_label, icon_desc, icon_button);
        icon_box.append(icon_text);
        root.append(icon_box);

        root.update = function () {
            Object.keys(card_nodes).forEach(mode => {
                let selected = export_state.mode === mode;
                card_nodes[mode].style.background = selected ? 'var(--color-selected)' : 'var(--color-back)';
                card_nodes[mode].style.borderTopColor = selected ? 'var(--color-accent)' : 'transparent';
                card_nodes[mode].style.borderLeftColor = selected ? 'var(--color-accent)' : 'transparent';
                card_nodes[mode].style.borderRightColor = selected ? 'var(--color-accent)' : 'transparent';
            });
            integrate_box.style.display = export_state.mode === 'integrate' ? 'block' : 'none';
            icon_box.style.display = export_state.mode === 'new_mod' ? 'flex' : 'none';
            Array.from(list.children).forEach(row => {
                let selected = row.__vs_mod_entry && row.__vs_mod_entry.path === export_state.existing_mod_path;
                row.style.background = selected ? 'var(--color-accent)' : (row.__vs_mod_entry ? 'var(--color-back)' : 'transparent');
                row.style.color = selected ? 'var(--color-accent_text)' : 'inherit';
            });
            let icon_url = vs_wizard_icon_source_url(export_state.mod_icon_source);
            icon_preview.style.backgroundImage = icon_url ? 'url("' + icon_url + '")' : '';
            icon_button_text.textContent = vs_wizard_icon_source_name(export_state.mod_icon_source);
        };
        root.update();
        return root;
    }

    function build_next_steps_panel() {
        let root = document.createElement('div');
        root.style.cssText = 'display:none;padding:14px 10px 20px;';
        let title = document.createElement('div');
        title.style.cssText = 'font-size:1.85em;font-weight:300;margin-bottom:8px;';
        title.textContent = 'Next Steps';
        let message = document.createElement('div');
        message.style.cssText = 'opacity:0.86;line-height:1.35;margin-bottom:18px;';
        let path_line = document.createElement('div');
        path_line.style.cssText = 'padding:8px 10px;margin-bottom:14px;border-radius:5px;background:var(--color-back);font-family:monospace;word-break:break-all;';
        let actions = document.createElement('div');
        actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;';
        function make_button(icon, label, click) {
            let button = document.createElement('button');
            button.type = 'button';
            button.style.cssText = 'display:inline-flex;align-items:center;gap:6px;min-height:34px;';
            try { button.append(Blockbench.getIconNode(icon)); } catch (_) {}
            let text = document.createElement('span');
            text.textContent = label;
            button.append(text);
            button.addEventListener('click', click);
            actions.append(button);
            return button;
        }
        make_button('view_in_ar', 'Open Block in Blockbench', () => {
            if (!last_export_result) return;
            if (dialog) dialog.hide();
            setTimeout(() => vs_wizard_open_generated_block(last_export_result, path_mod, fs_mod), 25);
        });
        make_button('folder_open', 'Open Mod Folder', () => {
            if (last_export_result) vs_wizard_open_in_explorer(last_export_result.mod_root);
        });
        make_button('code', 'Open in VS Code', () => {
            if (last_export_result) vs_wizard_open_in_vscode(last_export_result.mod_root);
        });
        make_button('play_arrow', 'Launch Vintage Story', () => vs_wizard_launch_vintage_story(path_mod, fs_mod));
        make_button('content_copy', 'Copy Block ID', () => {
            if (!last_export_result) return;
            let ref = last_export_result.mod_id + ':' + last_export_result.block_code;
            try { if (typeof Clipbench !== 'undefined') Clipbench.setText(ref); }
            catch (_) {}
            Blockbench.showQuickMessage('Copied ' + ref, 1400);
        });
        let hint = document.createElement('div');
        hint.style.cssText = 'opacity:0.74;line-height:1.35;max-width:660px;';
        hint.textContent = 'Enable the mod in Vintage Story, then search for the block in creative inventory. You can come back to this page after generation without re-running the export.';
        root.append(title, message, path_line, actions, hint);
        root.update = function () {
            if (!last_export_result) {
                message.textContent = 'Generate the block first, then the finished mod details will appear here.';
                path_line.textContent = '';
                return;
            }
            message.textContent = last_export_result.integrated
                ? 'The block has been added to your existing Vintage Story mod.'
                : 'The new Vintage Story content mod has been exported.';
            path_line.textContent = last_export_result.mod_root;
        };
        root.update();
        return root;
    }

    let export_panel = build_export_panel();
    let next_steps_panel = build_next_steps_panel();

    function set_step(index, from_sidebar) {
        current_page_index = Math.max(0, Math.min(pages.length - 1, index));
        current_page = pages[current_page_index].id;
        stepper.update(current_page_index);
        gallery.root.style.display = (current_page === 'preset') ? 'block' : 'none';
        export_panel.style.display = (current_page === 'export') ? 'block' : 'none';
        next_steps_panel.style.display = (current_page === 'next_steps') ? 'block' : 'none';
        if (export_panel.update) export_panel.update();
        if (next_steps_panel.update) next_steps_panel.update();
        if (dialog && dialog.form) dialog.form.updateValues({ cause: 'page' });
        if (!from_sidebar && dialog && dialog.sidebar) {
            sidebar_switching = true;
            dialog.sidebar.setPage(current_page);
            sidebar_switching = false;
        }
        if (nav_buttons && nav_buttons.length >= 2) {
            nav_buttons[0].disabled = current_page_index === 0;
            nav_buttons[1].textContent = current_page === 'next_steps' ? 'Done' : (current_page === 'export' ? 'Generate' : 'Next');
        }
        scroll_dialog_to_top();
    }

    function show_required_message(message, time) {
        Blockbench.showQuickMessage(message, time || 1800);
    }

    function is_blank(value) {
        return !String(value || '').trim();
    }

    function parse_optional_json_field(form, key, label, required) {
        let raw = String(form[key] || '').trim();
        if (!raw) {
            if (required) {
                show_required_message(label + ' is required');
                return false;
            }
            return true;
        }
        try { parse_vs_json(raw); }
        catch (e) {
            show_required_message(label + ' must be valid JSON', 2200);
            return false;
        }
        return true;
    }

    function validate_step(page, form) {
        form = form || {};
        if (page === 'preset') {
            if (!selected_preset_id) {
                show_required_message('Choose a preset first');
                return false;
            }
        }
        if (page === 'block') {
            if (is_blank(form.block_code)) {
                show_required_message('Block code is required');
                return false;
            }
            if (!/^[a-z0-9_-]+$/.test(String(form.block_code || '').trim())) {
                show_required_message('Block code can only use lowercase letters, numbers, hyphens, and underscores', 2600);
                return false;
            }
            if (is_blank(form.block_display_name)) {
                show_required_message('Display name is required');
                return false;
            }
        }
        if (page === 'appearance' && form.drawtype === 'current' && !has_vs_model) {
            show_required_message('Open or create a Vintage Story model before exporting it as a shape', 2200);
            return false;
        }
        if (page === 'appearance' && form.drawtype === 'custom' && is_blank(form.shape_base)) {
            show_required_message('Custom shape path is required');
            return false;
        }
        if (page === 'appearance' && form.renderpass === 'custom' && is_blank(form.renderpass_custom)) {
            show_required_message('Custom render pass is required');
            return false;
        }
        if (page === 'properties') {
            if (is_blank(form.blockmaterial)) {
                show_required_message('Block material is required');
                return false;
            }
            let resistance = parseFloat(form.resistance);
            if (isNaN(resistance) || resistance < 0) {
                show_required_message('Resistance must be 0 or higher');
                return false;
            }
        }
        if (page === 'world') {
            if (form.climate_color_map === 'custom' && is_blank(form.climate_color_map_custom)) {
                show_required_message('Custom climate map is required');
                return false;
            }
            if (form.season_color_map === 'custom' && is_blank(form.season_color_map_custom)) {
                show_required_message('Custom season map is required');
                return false;
            }
            if (!parse_optional_json_field(form, 'light_hsv_json', 'Advanced Light HSV JSON', false)) return false;
            if (!parse_optional_json_field(form, 'collisionbox_json', 'Collision Box JSON', collision_choice_state === 'custom')) return false;
            if (!parse_optional_json_field(form, 'selectionbox_json', 'Selection Box JSON', selection_choice_state === 'custom')) return false;
        }
        if (page === 'drops' && !parse_optional_json_field(form, 'drops_json', 'Drops JSON', false)) return false;
        if (page === 'sounds') {
            let sound_fields = ['sound_place', 'sound_walk', 'sound_break', 'sound_hit'];
            for (let i = 0; i < sound_fields.length; i++) {
                let value = String(form[sound_fields[i]] || '').trim();
                if (value && !/^(?:[a-z0-9_.-]+:)?[a-z0-9_./-]+$/i.test(value)) {
                    show_required_message('Sound paths can look like block/rock or game:block/rock', 2600);
                    return false;
                }
            }
        }
        if (page === 'advanced') {
            if (form.texture_mode === 'custom' && is_blank(form.textures_json)) {
                show_required_message('Textures JSON is required when Texture JSON Mode is Custom', 2600);
                return false;
            }
            if (form.combustible_preset === 'custom' && is_blank(form.combustibleprops_json)) {
                show_required_message('Combustible Props JSON is required when Combustible is Custom', 2600);
                return false;
            }
            let json_fields = [
                ['textures_json', 'Textures JSON Override'],
                ['texturesbytype_json', 'Textures By Type JSON'],
                ['shape_json', 'Shape JSON Override'],
                ['variantgroups_json', 'Variant Groups JSON'],
                ['behaviors_json', 'Behaviors JSON'],
                ['attributes_json', 'Attributes JSON'],
                ['combustibleprops_json', 'Combustible Props JSON'],
                ['particleproperties_json', 'Particle Properties JSON'],
                ['extra_json', 'Extra Blocktype JSON']
            ];
            for (let i = 0; i < json_fields.length; i++) {
                if (!parse_optional_json_field(form, json_fields[i][0], json_fields[i][1], false)) return false;
            }
        }
        if (page === 'export') {
            if (export_state.mode === 'new_mod') {
                if (is_blank(form.output_folder)) {
                    show_required_message('Output folder is required');
                    return false;
                }
                if (is_blank(form.mod_id)) {
                    show_required_message('Mod ID is required');
                    return false;
                }
                if (!/^[a-z0-9]+$/.test(String(form.mod_id || '').trim())) {
                    show_required_message('Mod ID can only use lowercase letters and numbers', 2400);
                    return false;
                }
                if (is_blank(form.mod_name)) {
                    show_required_message('Mod name is required');
                    return false;
                }
                if (is_blank(form.mod_version)) {
                    show_required_message('Version is required');
                    return false;
                }
            } else {
                let existing_path = String(export_state.existing_mod_path || form.existing_mod_folder || '').trim();
                if (!existing_path) {
                    show_required_message('Select an existing mod folder');
                    return false;
                }
                try {
                    if (!fs_mod.existsSync(path_mod.join(existing_path, 'modinfo.json'))) {
                        show_required_message('Existing mod folder must contain modinfo.json', 2400);
                        return false;
                    }
                } catch (_) {
                    show_required_message('Existing mod folder could not be checked', 2400);
                    return false;
                }
            }
        }
        return true;
    }

    function get_current_form() {
        try { return dialog && dialog.getFormResult ? dialog.getFormResult() : {}; }
        catch (_) { return {}; }
    }

    function can_move_to_step(index, form) {
        let target_index = Math.max(0, Math.min(pages.length - 1, index));
        if (target_index <= current_page_index) return true;
        if (pages[target_index].id === 'next_steps' && !last_export_result) {
            show_required_message('Generate the block before opening Next Steps', 2200);
            return false;
        }
        form = form || get_current_form();
        for (let page_index = current_page_index; page_index < target_index; page_index++) {
            if (!validate_step(pages[page_index].id, form)) return false;
        }
        return true;
    }

    function try_set_step(index, from_sidebar, form) {
        if (!can_move_to_step(index, form)) return false;
        set_step(index, from_sidebar);
        return true;
    }

    let asset_presets = build_vs_asset_block_presets(path_mod, fs_mod);
    let presets = asset_presets.length ? asset_presets : VS_BLOCK_PRESETS;
    if (asset_presets.length) default_tex_uuid = '__preset__';
    let gallery = build_vs_preset_gallery(presets, p => {
        let values = p.apply();
        selected_preset_id = p.id || '';
        selected_preset_texture_path = values.preset_texture_path || '';
        selected_preset_shape_base = values.shape_base || '';
        selected_preset_shape_json = values.shape_json || '';
        selected_preset_drawtype = values.drawtype || (selected_preset_shape_base || selected_preset_shape_json ? 'json' : 'cube');
        selected_preset_collisionbox = values.collisionbox_preset || 'full';
        values.drawtype = values.use_current_shape ? 'current' : 'preset';
        if (selected_preset_texture_path) values.texture_base = '__preset__';
        values.use_current_shape = values.drawtype === 'current';
        values.collisionbox_preset = 'match';
        shape_choice_state = values.drawtype;
        collision_choice_state = 'match';
        delete values.block_code;
        delete values.block_display_name;
        if (dialog && dialog.setFormValues) dialog.setFormValues(values, true);
        if (current_page === 'preset') set_step(1);
    });

    dialog = new Dialog({
        id: 'vs_block_wizard',
        title: 'Vintage Story Block Wizard',
        width: 820,
        lines: [stepper.root, gallery.root, export_panel, next_steps_panel],
        buttons: ['Back', 'Next', 'Cancel'],
        confirmIndex: 1,
        cancelIndex: 2,
        sidebar: {
            pages: {
                preset:     { label: 'Preset',         icon: 'view_module' },
                block:      { label: 'Naming',         icon: 'description' },
                appearance: { label: 'Shape',          icon: 'view_in_ar' },
                properties: { label: 'Behavior',       icon: 'tune' },
                world:      { label: 'Appearance',     icon: 'visibility' },
                drops:      { label: 'Loot',           icon: 'diamond' },
                sounds:     { label: 'Sounds',         icon: 'volume_up' },
                advanced:   { label: 'Advanced',       icon: 'data_object' },
                export:     { label: 'Export',         icon: 'file_download' },
                next_steps: { label: 'Next Steps',     icon: 'queue_play_next' }
            },
            page: 'preset',
            onPageSwitch(page) {
                if (sidebar_switching) return true;
                let index = pages.findIndex(p => p.id === page);
                if (index >= 0) return try_set_step(index, true);
                return true;
            }
        },
        form: {
            _block_head: {
                type: 'info', condition: on_page('block'),
                text: '## Block Naming\nName the block players will place in the world. Mod names are handled later on the Export page.'
            },
            block_code: {
                label: 'Block Code', type: 'input', value: 'myblock',
                condition: on_page('block'),
                description: 'The file-safe name for this block. Use lowercase letters, numbers, hyphens, or underscores.'
            },
            block_display_name: {
                label: 'Display Name', type: 'input', value: 'My Block',
                condition: on_page('block'),
                description: 'The name players see in game, like "Granite Brick".'
            },
            creative_tabs: {
                label: 'Creative Tab', type: 'select', default: 'general',
                condition: on_page('block'),
                options: {
                    general: 'Everything', flora: 'Flora', terrain: 'Terrain', decorative: 'Decorative', clutter: 'Clutter',
                    construction: 'Construction', mechanics: 'Mechanics', aquatic: 'Aquatic', items: 'Items', liquids: 'Liquids',
                    tools: 'Tools', clothing: 'Clothing', creatures: 'Creatures', special: 'Special',
                    none: 'Do not add to creative inventory', custom: 'Custom / multiple tabs below'
                },
                description: 'Choose where players find this block in creative mode.'
            },
            creative_tabs_extra: {
                label: 'Extra / Custom Tabs', type: 'input', value: '',
                condition: on_page('block'),
                description: 'Optional extra tabs, separated by commas. Example: decorative,myblocks.'
            },

            _app_head: {
                type: 'info', condition: on_page('appearance'),
                text: '## Shape\nChoose what the block looks like. Most presets should stay on **Selected Preset Shape**.'
            },
            drawtype: {
                label: 'Block Shape', type: 'select', default: 'preset',
                condition: on_page('appearance'),
                options: {
                    preset: 'Selected Preset Shape',
                    cube: 'Cube',
                    slab: 'Slab',
                    stairs: 'Stairs / steps',
                    cross: 'Cross plant',
                    empty: 'Invisible / empty',
                    current: 'Current Blockbench model',
                    custom: 'Custom VS shape path'
                },
                description: 'Pick the visible shape. Preset is best unless you want to change it.'
            },
            shape_base: {
                label: 'Custom Shape Path', type: 'input', value: '',
                condition: on_shape_custom,
                description: 'Use this only if you know the shape path. Example: game:block/basic/slab/slab-down.'
            },
            texture_base: {
                label: 'Base Texture', type: 'select',
                default: default_tex_uuid, options: texture_options,
                condition: on_page('appearance'),
                description: 'Choose the picture for the block. Preset uses the texture from the block you picked.'
            },
            renderpass: {
                label: 'Render Pass', type: 'select', default: '',
                condition: on_page('appearance'),
                options: {
                    '': 'Default', Opaque: 'Opaque', OpaqueNoCull: 'Opaque, no face culling', Transparent: 'Transparent',
                    TopSoil: 'Top soil / grass overlay', Liquid: 'Liquid', Meta: 'Meta / helper block', custom: 'Custom value below'
                },
                description: 'Usually leave this on Default. Use Transparent for glass or see-through textures.'
            },
            renderpass_custom: {
                label: 'Custom Render Pass', type: 'input', value: '',
                condition: on_page('appearance'),
                description: 'Type a render pass name here only when Render Pass is set to Custom.'
            },
            sideopaque: {
                label: 'Side Opaque', type: 'select', default: '',
                condition: on_page('appearance'),
                options: { '': 'Default', true: 'True', false: 'False' },
                description: 'Usually leave Default. Use False for glass, leaves, plants, or thin shapes.'
            },
            sidesolid: {
                label: 'Side Solid', type: 'select', default: '',
                condition: on_page('appearance'),
                options: { '': 'Default', true: 'True', false: 'False' },
                description: 'Usually leave Default. Use False when the sides should not act like a full block.'
            },
            face_cull_mode: {
                label: 'Face Cull Mode', type: 'input', value: '',
                condition: on_page('appearance'),
                description: 'Advanced: controls when hidden faces are skipped.'
            },
            collisionbox_preset: {
                label: 'Collision Box', type: 'select', default: 'match',
                condition: on_page('appearance'),
                options: {
                    match: 'Match block shape', full: 'Full block', none: 'No collision', lower_slab: 'Lower half slab', carpet: 'Thin layer', plant: 'Small plant center', custom: 'Custom JSON on World page'
                },
                description: 'The solid part players and creatures bump into.'
            },
            selectionbox_preset: {
                label: 'Selection Box', type: 'select', default: 'same',
                condition: on_page('appearance'),
                options: {
                    same: 'Same as collision', match: 'Match block shape', full: 'Full block', none: 'Not selectable', lower_slab: 'Lower half slab', carpet: 'Thin layer', plant: 'Small plant center', custom: 'Custom JSON on World page'
                },
                description: 'The part players can point at, select, and break.'
            },
            random_draw_offset: {
                label: 'Random Visual Offset', type: 'checkbox', value: false,
                condition: on_page('appearance'),
                description: 'Moves each placed block a tiny bit. Good for plants, rocks, and clutter.'
            },

            _props_head: {
                type: 'info', condition: on_page('properties'),
                text: '## Behavior\nChoose how the block feels in game: how hard it is, what tool it needs, and how players move on it.'
            },
            blockmaterial: {
                label: 'Block Material', type: 'select', default: 'Stone',
                condition: on_page('properties'),
                options: {
                    Soil: 'Soil', Gravel: 'Gravel', Sand: 'Sand', Wood: 'Wood',
                    Leaves: 'Leaves', Stone: 'Stone', Metal: 'Metal', Glass: 'Glass',
                    Cloth: 'Cloth', Plant: 'Plant', Ceramic: 'Ceramic',
                    Snow: 'Snow', Ice: 'Ice', Liquid: 'Liquid', Other: 'Other'
                },
                description: 'Pick what the block is made of. This helps the game choose default sounds and effects.'
            },
            resistance: {
                label: 'Resistance', type: 'range', value: 3.5, step: 0.1, min: 0, max: 30, editable_range_label: true, full_width: true,
                condition: on_page('properties'),
                description: 'How long it takes to break. Dirt is low, stone is medium, metal is high.'
            },
            required_mining_tier: {
                label: 'Required Mining Tier', type: 'select', default: '0',
                condition: on_page('properties'),
                options: { '0': 'None / hand', '1': 'Copper', '2': 'Bronze', '3': 'Iron', '4': 'Steel', '5': 'Tier 5', '6': 'Tier 6', '7': 'Tier 7' },
                description: 'The weakest tool tier that can break it. 0 means hands are enough.'
            },
            material_density: {
                label: 'Material Density', type: 'number', value: 0, step: 1, min: 0,
                condition: on_page('properties'),
                description: 'Optional weight value. Leave at 0 unless you need it.'
            },
            replaceable: {
                label: 'Replaceable', type: 'range', value: 0, step: 1, min: 0, max: 9999, editable_range_label: true, full_width: true,
                condition: on_page('properties'),
                description: 'How easily another block can replace it. Solid blocks usually stay at 0.'
            },
            fertility: {
                label: 'Fertility', type: 'range', value: 0, step: 1, min: 0, max: 100, editable_range_label: true, full_width: true,
                condition: on_page('properties'),
                description: 'For soil blocks. Higher numbers grow crops better.'
            },
            frostable: {
                label: 'Frostable', type: 'select', default: '',
                condition: on_page('properties'),
                options: { '': 'Default', true: 'True', false: 'False' },
                description: 'Choose whether frost can appear on this block.'
            },
            movement_preset: {
                label: 'Movement Feel', type: 'select', default: 'normal',
                condition: on_page('properties'),
                options: {
                    normal: 'Normal', slow: 'Slow walking', web: 'Very slow, like web', slippery: 'Slippery, like ice'
                },
                description: 'Choose how it changes player movement when walked through or on.'
            },
            combustible_preset: {
                label: 'Combustible', type: 'select', default: 'none',
                condition: on_page('properties'),
                options: { none: 'No', wood: 'Wood-like', leaves: 'Leaves / plant-like', fuel: 'Fuel block', custom: 'Custom JSON on Advanced page' },
                description: 'Choose whether this block can burn like wood, leaves, or fuel.'
            },

            _world_head: {
                type: 'info', condition: on_page('world'),
                text: '## World Rules\nSet light, color tinting, and any custom hit boxes.'
            },
            light_absorption: {
                label: 'Light Absorption', type: 'range', value: 0, min: 0, max: 32, step: 1, editable_range_label: true, full_width: true,
                condition: on_page('world'),
                description: 'How much light the block blocks. 0 lets light pass through.'
            },
            light_hue: {
                label: 'Light Hue', type: 'range', value: 7, min: 0, max: 31, step: 1, editable_range_label: true, full_width: true,
                condition: on_page('world'),
                description: 'Color of the light this block gives off. Only matters if brightness is above 0.'
            },
            light_saturation: {
                label: 'Light Saturation', type: 'range', value: 5, min: 0, max: 7, step: 1, editable_range_label: true, full_width: true,
                condition: on_page('world'),
                description: 'How colorful the light is. 0 is plain white light.'
            },
            light_brightness: {
                label: 'Light Brightness', type: 'range', value: 0, min: 0, max: 31, step: 1, editable_range_label: true, full_width: true,
                condition: on_page('world'),
                description: 'How bright the block glows. 0 means it does not glow.'
            },
            light_hsv_json: {
                label: 'Advanced Light HSV JSON', type: 'input', value: '',
                condition: on_page('world'),
                description: 'Advanced: type the exact light array if you do not want to use the sliders.'
            },
            climate_color_map: {
                label: 'Climate Color Map', type: 'select', default: '',
                condition: on_page('world'),
                options: { '': 'None', climatePlantTint: 'Plant tint', climateWaterTint: 'Water tint', custom: 'Custom value below' },
                description: 'Lets the world climate color this block, like grass or leaves.'
            },
            climate_color_map_custom: {
                label: 'Custom Climate Map', type: 'input', value: '',
                condition: on_page('world'),
                description: 'Advanced: custom climate color map name.'
            },
            season_color_map: {
                label: 'Season Color Map', type: 'select', default: '',
                condition: on_page('world'),
                options: { '': 'None', seasonFoliage: 'Season foliage', seasonGrass: 'Season grass', custom: 'Custom value below' },
                description: 'Lets the block color change with the seasons.'
            },
            season_color_map_custom: {
                label: 'Custom Season Map', type: 'input', value: '',
                condition: on_page('world'),
                description: 'Advanced: custom season color map name.'
            },
            collisionbox_json: {
                label: 'Collision Box JSON', type: 'textarea', value: '', height: 70,
                condition: on_collision_custom,
                description: 'Advanced: exact collision box JSON.'
            },
            selectionbox_json: {
                label: 'Selection Box JSON', type: 'textarea', value: '', height: 70,
                condition: on_selection_custom,
                description: 'Advanced: exact selection box JSON.'
            },

            _drops_head: {
                type: 'info', condition: on_page('drops'),
                text: '## Loot\nChoose what drops when the block breaks. Leave this blank to use the normal default.'
            },
            drops_json: {
                label: 'Drops JSON', type: 'textarea', value: '', height: 150,
                condition: on_page('drops'),
                description: 'Advanced: exact drops JSON copied into the block file.'
            },

            _sounds_head: {
                type: 'info', condition: on_page('sounds'),
                text: '## Sounds\nPick custom sounds, or leave them blank and let the material choose. Paths like `block/rock` are OK; the wizard exports them as `game:block/rock`.'
            },
            sound_place: {
                label: 'Place Sound', type: 'input', value: '',
                condition: on_page('sounds'),
                description: 'Sound played when the block is placed.'
            },
            sound_walk: {
                label: 'Walk Sound', type: 'input', value: '',
                condition: on_page('sounds'),
                description: 'Sound played when a player walks on it.'
            },
            sound_break: {
                label: 'Break Sound', type: 'input', value: '',
                condition: on_page('sounds'),
                description: 'Sound played when the block breaks.'
            },
            sound_hit: {
                label: 'Hit Sound', type: 'input', value: '',
                condition: on_page('sounds'),
                description: 'Sound played while the player is mining it.'
            },

            _advanced_head: {
                type: 'info', condition: on_page('advanced'),
                text: '## Advanced JSON\nThese fields are for people who already know Vintage Story block JSON. Most blocks can leave this page alone.'
            },
            block_class: {
                label: 'Block Class', type: 'input', value: '',
                condition: on_page('advanced'),
                description: 'Advanced: custom block class name, if your mod code provides one.'
            },
            entity_class: {
                label: 'Entity Class', type: 'input', value: '',
                condition: on_page('advanced'),
                description: 'Advanced: custom block entity class name, if your mod code provides one.'
            },
            textures_json: {
                label: 'Textures JSON Override', type: 'textarea', value: '', height: 100,
                condition: on_page('advanced'),
                description: 'Advanced: exact textures JSON. Leave blank for the selected texture.'
            },
            texture_mode: {
                label: 'Texture JSON Mode', type: 'select', default: 'single',
                condition: on_page('advanced'),
                options: {
                    single: 'Use selected base texture',
                    source: 'Use source texture JSON from preset',
                    custom: 'Use custom texture JSON from Advanced'
                },
                description: 'Use the selected texture for simple blocks. Use source/custom only for advanced texture maps.'
            },
            texture_key: {
                label: 'Texture Slot(s)', type: 'input', value: 'all',
                condition: on_page('advanced'),
                description: 'Advanced: texture slot names. Simple cube blocks usually use all.'
            },
            texturesbytype_json: {
                label: 'Textures By Type JSON', type: 'textarea', value: '', height: 100,
                condition: on_page('advanced'),
                description: 'Advanced: exact texturesByType JSON.'
            },
            shape_json: {
                label: 'Shape JSON Override', type: 'textarea', value: '', height: 80,
                condition: on_page('advanced'),
                description: 'Advanced: exact shape JSON. Leave blank to use the shape choice.'
            },
            variantgroups_json: {
                label: 'Variant Groups JSON', type: 'textarea', value: '', height: 100,
                condition: on_page('advanced'),
                description: 'Advanced: exact variantgroups JSON.'
            },
            behaviors_json: {
                label: 'Behaviors JSON', type: 'textarea', value: '', height: 110,
                condition: on_page('advanced'),
                description: 'Advanced: exact behaviors JSON.'
            },
            attributes_json: {
                label: 'Attributes JSON', type: 'textarea', value: '', height: 110,
                condition: on_page('advanced'),
                description: 'Advanced: exact attributes JSON.'
            },
            combustibleprops_json: {
                label: 'Combustible Props JSON', type: 'textarea', value: '', height: 80,
                condition: on_page('advanced'),
                description: 'Advanced: exact combustibleProps JSON.'
            },
            particleproperties_json: {
                label: 'Particle Properties JSON', type: 'textarea', value: '', height: 80,
                condition: on_page('advanced'),
                description: 'Advanced: exact particleProperties JSON.'
            },
            extra_json: {
                label: 'Extra Blocktype JSON', type: 'textarea', value: '', height: 120,
                condition: on_page('advanced'),
                description: 'Advanced: extra JSON fields to add to the block file.'
            },

            _out_head: {
                type: 'info', condition: on_page('export'),
                text: '## Export\nChoose where this block should go. New Mod makes a fresh mod folder. Integrate adds the block to a mod you already have.'
            },
            output_folder: {
                label: 'Output Folder', type: 'folder', value: default_out,
                condition: on_export_new,
                description: 'Folder where the new mod folder will be made.'
            },
            mod_id: {
                label: 'Mod ID', type: 'input', value: 'myblockmod',
                condition: on_export_new,
                description: 'Short folder name for the mod. Use lowercase letters and numbers.'
            },
            mod_name: {
                label: 'Mod Name', type: 'input', value: 'My Block Mod',
                condition: on_export_new,
                description: 'Name shown in the Vintage Story mod list.'
            },
            mod_version: {
                label: 'Version', type: 'input', value: '1.0.0',
                condition: on_export_new,
                description: 'Version number for this mod. Example: 1.0.0.'
            },
            mod_author: {
                label: 'Author', type: 'input', value: '',
                condition: on_export_new,
                description: 'Who made the mod. You can use your name or handle.'
            },
            mod_description: {
                label: 'Description', type: 'textarea', value: '',
                condition: on_export_new,
                description: 'Short text shown in the mod list.'
            },
            existing_mod_folder: {
                label: 'Existing Mod Folder', type: 'folder', value: '',
                condition: on_export_integrate,
                description: 'Choose an unzipped mod folder that contains modinfo.json.'
            }
        },
        onBuild(object) {
            dialog_object = object;
            nav_buttons = Array.from(object.querySelectorAll('.button_bar button'));
            set_step(current_page_index);
        },
        onOpen() {
            set_step(current_page_index);
        },
        onFormChange(form) {
            update_dynamic_form_state(form);
        },
        onButton(button_index) {
            if (button_index === 0) {
                set_step(current_page_index - 1);
                return false;
            }
        },
        onConfirm(form) {
            if (current_page === 'next_steps') return true;
            if (current_page === 'export') {
                if (!validate_step(current_page, form)) return false;
                try {
                    form.export_mode = export_state.mode;
                    form.existing_mod_path = export_state.existing_mod_path || form.existing_mod_folder || '';
                    form.mod_icon_source = export_state.mod_icon_source;
                    form.preset_texture_path = selected_preset_texture_path;
                    form.preset_drawtype = selected_preset_drawtype;
                    form.preset_collisionbox_preset = selected_preset_collisionbox;
                    if (form.drawtype === 'preset') {
                        form.shape_base = selected_preset_shape_base || '';
                        form.shape_json = selected_preset_shape_json || '';
                        form.use_current_shape = false;
                    } else if (form.drawtype === 'current') {
                        form.shape_base = '';
                        form.shape_json = '';
                        form.use_current_shape = true;
                    } else if (form.drawtype !== 'custom') {
                        form.shape_base = vs_wizard_basic_shape_base(form.drawtype);
                        form.use_current_shape = false;
                    } else {
                        form.use_current_shape = false;
                    }
                    last_export_result = generate_vs_block_mod(form, path_mod, fs_mod);
                    Blockbench.showQuickMessage((last_export_result.integrated ? 'Block integrated: ' : 'Mod generated: ') + last_export_result.mod_root, 3000);
                    set_step(pages.findIndex(page => page.id === 'next_steps'));
                } catch (e) {
                    console.error('[vs_wizard] block generate failed', e);
                    Blockbench.showMessageBox({
                        title: 'Block Wizard Error',
                        message: 'Failed to generate mod:\n\n' + (e && e.message ? e.message : String(e))
                    });
                }
                return false;
            }
            if (current_page_index < pages.length - 1) {
                try_set_step(current_page_index + 1, false, form);
                return false;
            }
        }
    });
    dialog.show();
}

function vs_wizard_drawtype_to_json(value, preset_drawtype) {
    let v = String(value || '').toLowerCase();
    if (v === 'preset') return vs_wizard_drawtype_to_json(preset_drawtype || 'cube');
    if (v === 'current' || v === 'custom' || v === 'slab' || v === 'stairs') return 'json';
    if (v === 'json') return 'json';
    if (v === 'cross') return 'cross';
    if (v === 'empty') return 'empty';
    return 'cube';
}

function vs_wizard_parse_optional_json(text, label) {
    let raw = String(text || '').trim();
    if (!raw) return undefined;
    try { return parse_vs_json(raw); }
    catch (e) { throw new Error('Invalid ' + label + ' JSON: ' + e.message); }
}

function vs_wizard_set_number(target, key, value, omit_zero) {
    let n = parseFloat(value);
    if (isNaN(n)) return;
    if (omit_zero && n === 0) return;
    target[key] = n;
}

function vs_wizard_set_int(target, key, value, omit_zero) {
    let n = parseInt(value, 10);
    if (isNaN(n)) return;
    if (omit_zero && n === 0) return;
    target[key] = n;
}

function vs_wizard_set_bool_select(target, key, value) {
    if (value === true || value === 'true') target[key] = true;
    else if (value === false || value === 'false') target[key] = false;
}

function vs_wizard_set_face_bool_select(target, key, value) {
    if (value === true || value === 'true') target[key] = { all: true };
    else if (value === false || value === 'false') target[key] = { all: false };
}

function vs_wizard_asset_texture_candidates(path_mod, rel) {
    let root = get_assets_root();
    if (!root || !rel) return [];
    rel = String(rel).replace(/\\/g, '/').replace(/^\/+/, '');
    let bases = [
        path_mod.join(root, 'survival', 'textures', rel),
        path_mod.join(root, 'game', 'textures', rel),
        path_mod.join(root, 'assets', 'survival', 'textures', rel),
        path_mod.join(root, 'assets', 'game', 'textures', rel),
        path_mod.join(root, 'textures', rel),
        path_mod.join(root, rel)
    ];
    let candidates = [];
    bases.forEach(base => {
        if (/\.(png|tga|jpe?g)$/i.test(base)) candidates.push(base);
        else ['.png', '.tga', '.jpg', '.jpeg'].forEach(ext => candidates.push(base + ext));
    });
    return candidates;
}

function vs_wizard_find_asset_texture(path_mod, fs_mod, rel) {
    let candidates = vs_wizard_asset_texture_candidates(path_mod, rel);
    for (let i = 0; i < candidates.length; i++) {
        try { if (fs_mod.existsSync(candidates[i])) return candidates[i]; }
        catch (_) {}
    }
    return '';
}

function vs_wizard_png_size(fs_mod, file_path) {
    try {
        let buf = fs_mod.readFileSync(file_path);
        if (buf.length >= 24 && buf.toString('ascii', 1, 4) === 'PNG') {
            return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
        }
    } catch (_) {}
    return null;
}

function vs_wizard_apply_full_texture_uv(cube, texture, size) {
    if (!cube || !cube.faces || !texture) return;
    let width = Math.max(1, parseInt((size && size.width) || texture.width || Project.texture_width || 16, 10));
    let height = Math.max(1, parseInt((size && size.height) || texture.height || Project.texture_height || 16, 10));
    Project.texture_width = width;
    Project.texture_height = height;
    FACE_KEYS.forEach(fk => {
        let face = cube.faces[fk];
        if (!face) return;
        face.texture = texture.uuid;
        face.uv = [0, 0, width, height];
        face.rotation = 0;
        face.vs_auto_uv = false;
    });
}

function vs_wizard_shape_textures_for_block(shape, block_textures, block_code) {
    let texture_map = {};
    let shape_keys = vs_wizard_collect_shape_texture_keys(shape);
    let fallback_ref = vs_wizard_texture_ref_from_node(block_textures && block_textures.all, {});
    if (!fallback_ref) fallback_ref = vs_wizard_find_texture_ref(block_textures);
    if (!fallback_ref && block_code) fallback_ref = 'block/' + block_code;

    shape_keys.forEach(texture_key => {
        let ref = vs_wizard_texture_ref_from_node(block_textures && block_textures[texture_key], {});
        if (!ref && fallback_ref) ref = fallback_ref;
        if (!ref && shape && shape.textures) ref = vs_wizard_texture_ref_from_node(shape.textures[texture_key], {});
        if (ref) texture_map[texture_key] = ref;
    });
    return texture_map;
}

function vs_wizard_virtual_shape_path_for_result(result, path_mod) {
    let mod_id = result.mod_id || 'mod';
    let block_code = result.block_code || 'block';
    let mod_root = result.mod_root || '';
    return path_mod.join(mod_root, 'assets', mod_id, 'shapes', 'block', block_code + '.json');
}

function vs_wizard_set_editable_blocktype_export(result) {
    if (!result || !result.blocktype_path) return;
    Project.export_path = result.blocktype_path;
    Project.export_codec = block_codec ? block_codec.id : 'vintagestory_block_shape';
    Project.__vs_wizard_blocktype_path = result.blocktype_path;
    Project.__vs_wizard_shape_path = result.shape_path || '';
    Project.__vs_wizard_source_shape_base = result.shape_base || '';
}

function vs_wizard_show_preset_shape_edit_notice(result) {
    if (!result || !result.shape_base) return;
    setTimeout(() => {
        Blockbench.showMessageBox({
            title: 'Editing a Preset Shape',
            icon: 'info',
            width: 520,
            message: [
                'This block is using a built-in Vintage Story shape right now.',
                '',
                'If you change the model, save it as a **Vintage Story Block Model**. The wizard will:',
                '',
                '- save your edited model as a new shape JSON inside this mod',
                '- update the blocktype JSON to use that new shape',
                '',
                'The original game preset stays untouched.'
            ].join('\n'),
            buttons: ['Got it']
        });
    }, 120);
}

function vs_wizard_open_generated_block(result, path_mod, fs_mod) {
    try {
        if (result.shape_path && fs_mod.existsSync(result.shape_path) && block_codec) {
            let content = fs_mod.readFileSync(result.shape_path, 'utf8');
            block_codec.load(content, {
                path: result.shape_path,
                name: path_mod.basename(result.shape_path),
                content: content
            });
            vs_wizard_set_editable_blocktype_export(result);
            return;
        }
        if (result.shape_base && block_codec) {
            let shape_info = vs_wizard_read_shape_from_base(path_mod, fs_mod, result.shape_base);
            if (shape_info && shape_info.json) {
                let shape_model = vs_wizard_clone_json(shape_info.json);
                shape_model.textures = Object.assign(
                    {},
                    shape_model.textures || {},
                    vs_wizard_shape_textures_for_block(shape_model, result.block_textures, result.block_code)
                );
                let virtual_shape_path = vs_wizard_virtual_shape_path_for_result(result, path_mod);
                block_codec.load(shape_model, {
                    path: virtual_shape_path,
                    name: path_mod.basename(virtual_shape_path),
                    content: JSON.stringify(shape_model),
                    no_file: true
                });
                vs_wizard_set_editable_blocktype_export(result);
                Project.name = result.block_code || Project.name || 'block';
                Canvas.updateAll();
                vs_wizard_show_preset_shape_edit_notice(result);
                return;
            }
        }
        if (!block_format || typeof setupProject !== 'function') return;
        setupProject(block_format);
        Project.name = result.block_code || 'block';
        let texture = null;
        if (result.texture_path && fs_mod.existsSync(result.texture_path)) {
            texture = new Texture({ name: result.block_code || 'block' });
            texture.fromPath(result.texture_path);
            texture.add();
        }
        let group = new Group({
            name: result.block_code || 'block',
            origin: [0, 0, 0],
            rotation: [0, 0, 0]
        }).init();
        group.addTo();
        let cube = new Cube({
            name: result.block_code || 'block',
            from: [0, 0, 0],
            to: [16, 16, 16],
            origin: [0, 0, 0],
            autouv: 1
        }).init();
        cube.addTo(group);
        if (texture) {
            cube.applyTexture(texture, true);
            vs_wizard_apply_full_texture_uv(cube, texture, vs_wizard_png_size(fs_mod, result.texture_path));
        }
        vs_wizard_set_editable_blocktype_export(result);
        Canvas.updateAll();
    } catch (e) {
        console.warn('[vs_wizard] could not open generated block in Blockbench', e);
        Blockbench.showQuickMessage('Generated mod, but could not open the block project automatically', 2500);
    }
}

function generate_vs_block_mod(form, path_mod, fs_mod) {
    let export_mode = form.export_mode === 'integrate' ? 'integrate' : 'new_mod';
    let integrated = export_mode === 'integrate';
    let block_code = String(form.block_code || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!block_code) throw new Error('Block code is required.');

    let mod_id = '';
    let mod_root = '';
    let modinfo = null;
    if (integrated) {
        mod_root = String(form.existing_mod_path || form.existing_mod_folder || '').trim();
        if (!mod_root) throw new Error('Select an existing mod folder.');
        if (!fs_mod.existsSync(mod_root)) throw new Error('Existing mod folder does not exist: ' + mod_root);
        modinfo = vs_wizard_read_modinfo(path_mod, fs_mod, mod_root) || {};
        mod_id = String(modinfo.modid || path_mod.basename(mod_root)).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!mod_id) throw new Error('Could not determine the existing mod id from modinfo.json.');
    } else {
        mod_id = String(form.mod_id || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!mod_id) throw new Error('Mod ID is required (lowercase, alphanumeric).');
        let out_root = form.output_folder || vs_wizard_default_mods_folder(path_mod);
        if (!out_root) throw new Error('Output folder is required.');
        if (!fs_mod.existsSync(out_root)) {
            // vs might not have a mods folder? or was deleted, better make sure
            try { fs_mod.mkdirSync(out_root, { recursive: true }); }
            catch (e) { throw new Error('Could not create output folder: ' + out_root + '\n' + e.message); }
        }
        mod_root = path_mod.join(out_root, mod_id);
        modinfo = {
            type: 'content',
            modid: mod_id,
            name: form.mod_name || mod_id,
            authors: form.mod_author ? String(form.mod_author).split(',').map(s => s.trim()).filter(Boolean) : [],
            description: form.mod_description || '',
            version: form.mod_version || '1.0.0',
            side: 'Universal'
        };
    }

    let assets_root = path_mod.join(mod_root, 'assets', mod_id);
    let blocktypes_dir = path_mod.join(assets_root, 'blocktypes');
    let lang_dir = path_mod.join(assets_root, 'lang');
    let textures_dir = path_mod.join(assets_root, 'textures', 'block');
    let shapes_dir = path_mod.join(assets_root, 'shapes', 'block');
    [mod_root, blocktypes_dir, lang_dir, textures_dir].forEach(d => {
        if (!fs_mod.existsSync(d)) fs_mod.mkdirSync(d, { recursive: true });
    });

    if (!integrated) {
        vs_wizard_write_mod_icon(fs_mod, path_mod, mod_root, form.mod_icon_source, modinfo);
        fs_mod.writeFileSync(path_mod.join(mod_root, 'modinfo.json'), JSON.stringify(modinfo, null, 2));
    }

    // block texture
    let texture_basename = block_code;
    let tex_filename = texture_basename + '.png';
    let tex_disk_path = path_mod.join(textures_dir, tex_filename);
    let wrote_texture = false;
    if (form.texture_base === '__preset__' && form.preset_texture_path) {
        let asset_texture = vs_wizard_find_asset_texture(path_mod, fs_mod, form.preset_texture_path);
        if (asset_texture) {
            fs_mod.copyFileSync(asset_texture, tex_disk_path);
            wrote_texture = true;
        }
    }
    if (!wrote_texture && form.texture_base && form.texture_base !== '__blank__' && form.texture_base !== '__preset__') {
        let texture = Texture.all.find(t => t.uuid === form.texture_base);
        if (texture) {
            let src = texture.source || '';
            if (typeof src === 'string' && src.startsWith('data:image')) {
                let b64 = src.substring(src.indexOf(',') + 1);
                fs_mod.writeFileSync(tex_disk_path, Buffer.from(b64, 'base64'));
                wrote_texture = true;
            } else if (texture.path && fs_mod.existsSync(texture.path)) {
                fs_mod.copyFileSync(texture.path, tex_disk_path);
                wrote_texture = true;
            }
        }
    }
    if (!wrote_texture) {
        vs_wizard_write_blank_texture(fs_mod, tex_disk_path, Project.texture_width, Project.texture_height);
    }

    // shape
    let shape_written = false;
    let custom_shape_texture_keys = [];
    let drawtype_json = vs_wizard_drawtype_to_json(form.drawtype || 'preset', form.preset_drawtype || 'cube');
    let shape_base = vs_wizard_normalize_runtime_asset_refs(String(form.shape_base || '').trim());
    let shape_override = vs_wizard_parse_optional_json(form.shape_json, 'shape');
    let write_custom_shape = drawtype_json === 'json' && (form.use_current_shape || form.drawtype === 'current') && !shape_base && shape_override === undefined;
    if (write_custom_shape) {
        if (!is_vs_format()) {
            throw new Error('"Export current model as shape" needs an open Vintage Story project.');
        }
        let shape_data = compile_vs_shape();
        let prepared_shape = vs_wizard_prepare_custom_shape_for_export(shape_data, texture_basename, vs_wizard_png_size(fs_mod, tex_disk_path));
        custom_shape_texture_keys = prepared_shape.texture_keys || [];
        let shape_path = path_mod.join(shapes_dir, block_code + '.json');
        if (!fs_mod.existsSync(shapes_dir)) fs_mod.mkdirSync(shapes_dir, { recursive: true });
        fs_mod.writeFileSync(shape_path, prepared_shape.text);
        shape_written = true;
    }

    let block_json = { code: block_code };
    let tab_parts = [];
    if (form.creative_tabs && form.creative_tabs !== 'none' && form.creative_tabs !== 'custom') tab_parts.push(form.creative_tabs);
    if (form.creative_tabs_extra) tab_parts = tab_parts.concat(String(form.creative_tabs_extra).split(','));
    let tabs = tab_parts.join(',')
        .split(',').map(s => s.trim()).filter(Boolean);
    if (tabs.length > 0) {
        block_json.creativeinventory = {};
        tabs.forEach(t => { block_json.creativeinventory[t] = ['*']; });
    }
    block_json.drawtype = drawtype_json;
    let textures_override = (!shape_written && (form.texture_mode === 'source' || form.texture_mode === 'custom'))
        ? vs_wizard_parse_optional_json(form.textures_json, 'textures')
        : undefined;
    block_json.textures = textures_override !== undefined
        ? textures_override
        : (() => {
            let textures = {};
            let texture_keys = shape_written && custom_shape_texture_keys.length ? custom_shape_texture_keys : vs_wizard_texture_keys(form.texture_key || 'all');
            texture_keys.forEach(texture_key => {
                textures[texture_key] = { base: vs_wizard_generated_texture_ref(mod_id, texture_basename) };
            });
            return textures;
        })();
    let textures_by_type = (form.texture_mode === 'source' || form.texture_mode === 'custom')
        ? vs_wizard_parse_optional_json(form.texturesbytype_json, 'texturesByType')
        : undefined;
    if (textures_by_type !== undefined) block_json.texturesByType = textures_by_type;
    if (shape_written) {
        block_json.shape = { base: mod_id + ':block/' + block_code };
    } else {
        if (shape_override !== undefined) block_json.shape = vs_wizard_normalize_runtime_asset_refs(shape_override);
        else if (shape_base) block_json.shape = { base: shape_base };
    }
    if (form.block_class && String(form.block_class).trim()) block_json.class = String(form.block_class).trim();
    if (form.entity_class && String(form.entity_class).trim()) block_json.entityClass = String(form.entity_class).trim();
    block_json.blockmaterial = form.blockmaterial || 'Stone';
    vs_wizard_set_number(block_json, 'resistance', form.resistance, false);
    vs_wizard_set_int(block_json, 'requiredMiningTier', form.required_mining_tier, true);
    vs_wizard_set_number(block_json, 'materialDensity', form.material_density, true);
    vs_wizard_set_int(block_json, 'replaceable', form.replaceable, true);
    vs_wizard_set_int(block_json, 'fertility', form.fertility, true);
    vs_wizard_set_int(block_json, 'lightAbsorption', form.light_absorption, true);
    vs_wizard_set_face_bool_select(block_json, 'sideopaque', form.sideopaque);
    vs_wizard_set_face_bool_select(block_json, 'sidesolid', form.sidesolid);
    vs_wizard_set_bool_select(block_json, 'frostable', form.frostable);
    let renderpass = vs_wizard_value_or_custom(form.renderpass, form.renderpass_custom);
    if (renderpass) block_json.renderpass = renderpass;
    if (form.face_cull_mode && String(form.face_cull_mode).trim()) block_json.faceCullMode = String(form.face_cull_mode).trim();
    let collisionbox = vs_wizard_parse_optional_json(form.collisionbox_json, 'collisionbox');
    let collisionbox_preset = form.collisionbox_preset === 'match'
        ? vs_wizard_collision_for_shape(form.drawtype, form.preset_drawtype, form.preset_collisionbox_preset)
        : form.collisionbox_preset;
    if (collisionbox !== undefined) block_json.collisionbox = collisionbox;
    else if (collisionbox_preset && collisionbox_preset !== 'full' && collisionbox_preset !== 'custom') {
        let box = vs_wizard_box_for_preset(collisionbox_preset);
        if (box !== undefined) block_json.collisionbox = box;
    }
    let selectionbox = vs_wizard_parse_optional_json(form.selectionbox_json, 'selectionbox');
    let selectionbox_preset = form.selectionbox_preset === 'match'
        ? vs_wizard_collision_for_shape(form.drawtype, form.preset_drawtype, form.preset_collisionbox_preset)
        : form.selectionbox_preset;
    if (selectionbox !== undefined) block_json.selectionbox = selectionbox;
    else if (selectionbox_preset && selectionbox_preset !== 'same' && selectionbox_preset !== 'full' && selectionbox_preset !== 'custom') {
        let box = vs_wizard_box_for_preset(selectionbox_preset);
        if (box !== undefined) block_json.selectionbox = box;
    }
    if (form.random_draw_offset) block_json.randomDrawOffset = true;
    if (form.movement_preset === 'slow') block_json.walkspeedmultiplier = 0.65;
    else if (form.movement_preset === 'web') block_json.walkspeedmultiplier = 0.25;
    else if (form.movement_preset === 'slippery') block_json.dragMultiplier = 0.02;
    let climate_map = vs_wizard_value_or_custom(form.climate_color_map, form.climate_color_map_custom);
    if (climate_map) block_json.climateColorMap = climate_map;
    let season_map = vs_wizard_value_or_custom(form.season_color_map, form.season_color_map_custom);
    if (season_map) block_json.seasonColorMap = season_map;
    let light_hsv = vs_wizard_parse_optional_json(form.light_hsv_json, 'lightHsv');
    if (light_hsv !== undefined) block_json.lightHsv = light_hsv;
    else {
        let light_brightness = parseInt(form.light_brightness, 10);
        if (!isNaN(light_brightness) && light_brightness > 0) {
            block_json.lightHsv = [
                parseInt(form.light_hue, 10) || 0,
                parseInt(form.light_saturation, 10) || 0,
                light_brightness
            ];
        }
    }
    let drops = vs_wizard_parse_optional_json(form.drops_json, 'drops');
    if (drops !== undefined) block_json.drops = drops;
    let behaviors = vs_wizard_parse_optional_json(form.behaviors_json, 'behaviors');
    if (behaviors !== undefined) block_json.behaviors = behaviors;
    let attributes = vs_wizard_parse_optional_json(form.attributes_json, 'attributes');
    if (attributes !== undefined) block_json.attributes = attributes;
    let variantgroups = vs_wizard_parse_optional_json(form.variantgroups_json, 'variantgroups');
    if (variantgroups !== undefined) block_json.variantgroups = variantgroups;
    let combustibleprops = vs_wizard_parse_optional_json(form.combustibleprops_json, 'combustibleProps');
    if (combustibleprops !== undefined) block_json.combustibleProps = combustibleprops;
    else if (form.combustible_preset === 'wood') block_json.combustibleProps = { burnTemperature: 700, burnDuration: 24 };
    else if (form.combustible_preset === 'leaves') block_json.combustibleProps = { burnTemperature: 600, burnDuration: 8 };
    else if (form.combustible_preset === 'fuel') block_json.combustibleProps = { burnTemperature: 800, burnDuration: 15 };
    let particleproperties = vs_wizard_parse_optional_json(form.particleproperties_json, 'particleProperties');
    if (particleproperties !== undefined) block_json.particleProperties = particleproperties;
    let sounds = {};
    ['place', 'walk', 'break', 'hit'].forEach(k => {
        let sound_ref = vs_wizard_sound_ref(form['sound_' + k]);
        if (sound_ref) sounds[k] = sound_ref;
    });
    if (Object.keys(sounds).length > 0) block_json.sounds = sounds;
    let extra = vs_wizard_parse_optional_json(form.extra_json, 'extra blocktype');
    if (extra !== undefined) {
        if (!extra || typeof extra !== 'object' || Array.isArray(extra)) {
            throw new Error('Extra Blocktype JSON must be an object.');
        }
        Object.assign(block_json, vs_wizard_normalize_runtime_asset_refs(extra));
    }
    block_json = vs_wizard_normalize_runtime_asset_refs(block_json);
    block_json = vs_wizard_normalize_blocktype_face_bools(block_json);
    if (block_json.textures !== undefined) block_json.textures = vs_wizard_normalize_generated_texture_refs(block_json.textures, mod_id, texture_basename);
    fs_mod.writeFileSync(
        path_mod.join(blocktypes_dir, block_code + '.json'),
        JSON.stringify(block_json, null, 2)
    );

    let lang_path = path_mod.join(lang_dir, 'en.json');
    let lang = {};
    try {
        if (fs_mod.existsSync(lang_path)) lang = parse_vs_json(fs_mod.readFileSync(lang_path, 'utf8')) || {};
    } catch (e) {
        console.warn('[vs_wizard] could not merge existing lang file, replacing it', e);
        lang = {};
    }
    lang['block-' + block_code] = form.block_display_name || block_code;
    tabs.forEach(t => {
        if (t === 'general') return;
        lang['game:tabname-' + t] = t.charAt(0).toUpperCase() + t.slice(1);
    });
    fs_mod.writeFileSync(lang_path, JSON.stringify(lang, null, 2));

    return {
        mod_root: mod_root,
        mod_id: mod_id,
        block_code: block_code,
        integrated: integrated,
        shape_path: shape_written ? path_mod.join(shapes_dir, block_code + '.json') : '',
        shape_base: shape_written ? '' : shape_base,
        block_textures: block_json.textures,
        texture_path: tex_disk_path,
        blocktype_path: path_mod.join(blocktypes_dir, block_code + '.json')
    };
}

// valid starter texture when no source texture is picked
const VS_WIZARD_PLACEHOLDER_PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQAQMAAAAlPW0iAAAABlBMVEX/AP8AAACfphTyAAAAH0lE' +
    'QVR4nGNgYGD4DwUMUMzwHwwYGBgZQGwGKAYAQGwDAUH0gZ8AAAAASUVORK5CYII=';

let action_block_wizard = null;
let block_wizard_loader = null;
let block_wizard_css = null;
let block_wizard_launching = false;

function get_vs_api() {
    let root = null;
    if (typeof window !== 'undefined') root = window;
    else if (typeof globalThis !== 'undefined') root = globalThis;
    return root && root.VintageStoryBlockbench ? root.VintageStoryBlockbench : null;
}

function require_vs_api() {
    let api = get_vs_api();
    if (api && api.basePluginId === 'vintagestory_wizard' && typeof api.parseJson === 'function' && typeof api.compileShape === 'function' && typeof api.loadBlockShape === 'function') return api;
    if (typeof Blockbench !== 'undefined' && Blockbench.showMessageBox) {
        Blockbench.showMessageBox({
            title: 'Vintage Story Support Required',
            message: 'Install and enable the base Vintage Story Support plugin before using the Vintage Story Block Wizard.'
        });
    } else if (typeof Blockbench !== 'undefined' && Blockbench.showQuickMessage) {
        Blockbench.showQuickMessage('Vintage Story Support plugin is required', 3000);
    }
    return null;
}

function focus_open_block_wizard_dialog() {
    if (typeof Dialog === 'undefined') return false;
    let existing_dialog = null;
    if (Dialog.open && Dialog.open.id === 'vs_block_wizard') existing_dialog = Dialog.open;
    if (!existing_dialog && Array.isArray(Dialog.stack)) {
        existing_dialog = Dialog.stack.find(open_dialog => open_dialog && open_dialog.id === 'vs_block_wizard') || null;
    }
    if (!existing_dialog) return false;
    try { existing_dialog.focus(); }
    catch (_) {}
    return true;
}

function open_block_wizard() {
    if (focus_open_block_wizard_dialog() || block_wizard_launching) return;
    let api = require_vs_api();
    if (!api) return;
    block_wizard_launching = true;
    try {
        open_vs_block_wizard_from_loader();
    } finally {
        setTimeout(() => { block_wizard_launching = false; }, 300);
    }
}

function random_background_url() {
    try { return vs_wizard_random_background_url() || ''; } catch (_) {}
    return '';
}

function register_actions() {
    action_block_wizard = new Action('vintagestory_block_wizard_open', {
        name: 'Vintage Story Block Wizard...',
        description: 'Create a Vintage Story block content mod. Requires the base Vintage Story Support plugin.',
        icon: 'fa-hat-wizard',
        category: 'tools',
        click() { open_block_wizard(); }
    });
    MenuBar.addAction(action_block_wizard, 'tools');
}

function unregister_actions() {
    if (action_block_wizard) {
        try { action_block_wizard.delete(); } catch (_) {}
        action_block_wizard = null;
    }
}

function register_loader() {
    if (typeof ModelLoader === 'undefined' || block_wizard_loader) return;
    let background_url = random_background_url();
    block_wizard_loader = new ModelLoader('vintagestory_block_wizard', {
        name: 'Vintage Story Block Wizard',
        description: 'Create a custom Vintage Story block in a few steps.',
        icon: 'fa-hat-wizard',
        target: 'Vintage Story',
        onStart() { open_block_wizard(); },
        format_page: {
            content: [
                { type: 'label', text: 'Use this wizard to make a new Vintage Story block mod.' },
                { type: 'label', text: 'Choose a preset, set the name and texture, then export it straight to your Mods folder.' }
            ],
            button_text: 'Create a VS Block!'
        }
    });

    if (typeof Blockbench !== 'undefined' && Blockbench.addCSS) {
        let background_css = background_url
            ? 'background-image: linear-gradient(to top, rgba(18,20,24,1) 0%, rgba(18,20,24,0.84) 42%, rgba(18,20,24,0.25) 100%), url("' + background_url + '");'
            : 'background: linear-gradient(to top, rgba(18,20,24,1) 0%, rgba(18,20,24,0.86) 48%, rgba(18,20,24,0.58) 100%);';
        block_wizard_css = Blockbench.addCSS(
            '.format_entry[format=vintagestory_block_wizard] { color: #d7a84d; }\n' +
            '#start_files .format_entry[format=vintagestory_block_wizard]:hover { color: #ffd071; }\n' +
            '#format_page_vintagestory_block_wizard content { display: block; min-height: 390px; padding: 26px 30px 96px; box-sizing: border-box; border-radius: 6px; background-size: cover; background-position: center; box-shadow: inset 0 -160px 130px rgba(0,0,0,0.35); overflow: hidden; ' + background_css + ' }\n' +
            '#format_page_vintagestory_block_wizard content > label { max-width: 430px; margin-bottom: 14px; display: block; line-height: 1.42; font-size: 1.05em; text-shadow: 0 2px 8px rgba(0,0,0,0.72); }\n' +
            '#format_page_vintagestory_block_wizard .button_bar { justify-content: right; }\n'
        );
    }
}

function unregister_loader() {
    if (block_wizard_loader) {
        try { block_wizard_loader.delete(); } catch (_) {}
        block_wizard_loader = null;
    }
    if (block_wizard_css) {
        try { block_wizard_css.delete(); } catch (_) {}
        block_wizard_css = null;
    }
}

Plugin.register('vintagestory_block_wizard', {
    title: 'Vintage Story Block Wizard',
    author: 'imtsubaki (tsu)',
    icon: 'fa-hat-wizard',
    description: 'Guided Vintage Story block content mod wizard. Requires the base Vintage Story Support plugin.',
    about: 'A separate wizard plugin for generating Vintage Story block content mods. It uses the model formats, codecs, asset helpers, and export implementation exposed by the base Vintage Story Support plugin.',
    tags: ['Vintage Story', 'Wizard', 'Block'],
    version: '0.1.0',
    min_version: '4.10.0',
    variant: 'both',
    onload() {
        register_actions();
        register_loader();
    },
    onunload() {
        unregister_loader();
        unregister_actions();
    }
});

})();
