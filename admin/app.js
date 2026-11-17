/* Administration — Groupe Ndoye Africa Holding.
 * Application sans dépendance externe, servie par l'API (même origine) :
 * aucune donnée n'est insérée en HTML brut (textContent uniquement), jeton CSRF gardé en mémoire. */
(() => {
  'use strict';

  // ───────── Outils ─────────
  const LANGS = [
    ['fr', 'Français'],
    ['en', 'English'],
    ['es', 'Español'],
    ['de', 'Deutsch'],
    ['zh', '中文'],
  ];
  const $app = document.getElementById('app');
  const $toast = document.getElementById('toast');
  const state = { csrf: '', email: '', siteOrigin: 'https://groupendoyeafrica.com' };

  /** Crée un élément : h('div', { class: 'x', onclick: fn }, 'texte', enfant…). */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = Boolean(v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of children.flat(Infinity)) {
      if (c === undefined || c === null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  const clone = (v) => JSON.parse(JSON.stringify(v ?? null));
  const fmtDate = (d) => (d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '');

  function toast(message, error = false) {
    const el = h('div', { class: error ? 'error' : '' }, message);
    $toast.append(el);
    setTimeout(() => el.remove(), error ? 7000 : 3500);
  }

  /** Aperçu d'image : chemins /Images/… servis par le site public. */
  const imgSrc = (v) => (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? state.siteOrigin + v : v || '');
  const safeImgSrc = (v) => {
    const s = imgSrc(v);
    return /^https:\/\//.test(s) || s.startsWith('data:') ? s : '';
  };

  // ───────── API ─────────
  async function api(path, { method = 'GET', body } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (method !== 'GET') headers['X-CSRF-Token'] = state.csrf;
    const res = await fetch(path, { method, headers, credentials: 'same-origin', body: body !== undefined ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && !path.startsWith('/api/auth/login')) {
      state.csrf = '';
      showLogin('Votre session a expiré. Reconnectez-vous.');
      throw new Error('Session expirée.');
    }
    if (!res.ok) {
      const details = Array.isArray(data.details) ? ` — ${data.details.map((d) => (d.path ? `${d.path} : ${d.message}` : d.message || d)).join(' ; ')}` : '';
      throw new Error((data.error || `Erreur ${res.status}`) + details);
    }
    return data;
  }

  async function guarded(btn, fn) {
    if (btn) btn.disabled = true;
    try {
      return await fn();
    } catch (err) {
      if (err.message !== 'Session expirée.') toast(err.message, true);
      return undefined;
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ───────── Description des rubriques ─────────
  const ICONS = ['building', 'layers', 'chart', 'road', 'leaf', 'zap', 'star', 'globe', 'home', 'heart'];
  const CATEGORIES = ['Immobilier', 'Infrastructure', 'Agriculture', 'Énergie', 'Autre'];
  const GALLERY = [
    ['overview', 'Vue générale'],
    ['exterior', 'Extérieur'],
    ['interior', 'Intérieur'],
    ['plans', 'Plans 3D'],
    ['buildings', 'Immeubles'],
    ['amenities', 'Commodités'],
  ];
  const PLATFORMS = ['youtube', 'tiktok', 'facebook', 'instagram'];

  const COLLECTIONS = {
    services: {
      label: 'Services',
      title: (d) => d.fr?.title,
      fields: [
        { key: 'icon', label: 'Icône', type: 'select', options: ICONS },
        { key: '*', label: 'Textes', type: 'langBlock', keys: [['title', 'Titre'], ['desc', 'Description', true]], required: 'title' },
      ],
    },
    villas: {
      label: 'Villas',
      title: (d) => d.fr?.name,
      thumb: (d) => d.img,
      fields: [
        { key: 'code', label: 'Code (ex. f3, f4-duplex) — identifiant utilisé par le site', type: 'text', required: true },
        { key: 'color', label: 'Couleur', type: 'color' },
        { key: 'surface', label: 'Surface du terrain', type: 'text' },
        { key: 'bati', label: 'Surface bâtie', type: 'text' },
        { key: 'img', label: 'Image principale', type: 'image', folder: 'villas', publicId: 'imgPublicId' },
        { key: 'planImg', label: 'Plan', type: 'image', folder: 'villas', publicId: 'planImgPublicId' },
        { key: '*', label: 'Nom et standing', type: 'langBlock', keys: [['name', 'Nom'], ['standing', 'Standing']], required: 'name' },
        { key: 'rooms', label: 'Pièces', type: 'rooms' },
        { key: 'features', label: 'Points forts (un par ligne)', type: 'features' },
      ],
    },
    partners: {
      label: 'Partenaires',
      title: (d) => (d.kind === 'africa' ? `${d.name} (Afrique)` : `${d.code || ''} — ${d.fr?.country || ''}`),
      fields: [
        { key: 'kind', label: 'Type', type: 'select', options: [['world', 'Partenaire mondial'], ['africa', 'Pays africain partenaire']] },
        { key: 'name', label: 'Nom du pays (pays africain)', type: 'text', when: (d) => d.kind === 'africa' },
        { key: 'code', label: 'Code pays à 2 lettres (ex. TR)', type: 'text', when: (d) => d.kind !== 'africa' },
        { key: '*', label: 'Pays et domaine', type: 'langBlock', keys: [['country', 'Pays'], ['focus', 'Domaine', true]], when: (d) => d.kind !== 'africa' },
      ],
      defaults: { kind: 'world' },
    },
    companies: {
      label: 'Entreprises',
      title: (d) => d.name,
      thumb: (d) => d.logo,
      fields: [
        { key: 'name', label: 'Nom', type: 'text', required: true },
        { key: 'logo', label: 'Logo', type: 'image', folder: 'companies', publicId: 'logoPublicId' },
        { key: 'sector', label: 'Secteur', type: 'langMap', required: true },
        { key: 'desc', label: 'Description', type: 'langMap', multiline: true, required: true },
        { key: 'website', label: 'Site web (https://…)', type: 'text' },
        { key: 'country', label: 'Pays', type: 'text' },
      ],
    },
    projects: {
      label: 'Projets',
      title: (d) => d.title?.fr,
      thumb: (d) => d.img,
      fields: [
        { key: 'category', label: 'Catégorie', type: 'select', options: CATEGORIES },
        { key: 'img', label: 'Image', type: 'image', folder: 'projects', publicId: 'imgPublicId' },
        { key: 'title', label: 'Titre', type: 'langMap', required: true },
        { key: 'desc', label: 'Description', type: 'langMap', multiline: true, required: true },
        { key: 'waMsg', label: 'Message WhatsApp', type: 'langMap', multiline: true },
      ],
    },
    gallery: {
      label: 'Galerie',
      title: (d) => d.fr,
      thumb: (d) => d.src,
      fields: [
        { key: 'cat', label: 'Catégorie', type: 'select', options: GALLERY },
        { key: 'src', label: 'Photo', type: 'image', folder: 'gallery', publicId: 'srcPublicId', required: true },
        { key: 'fallback', label: 'Image de secours (lien https, facultatif)', type: 'text' },
        { key: '*', label: 'Légende', type: 'langStrings', required: true },
      ],
      defaults: { cat: 'exterior' },
    },
    videos: {
      label: 'Vidéos',
      title: (d) => d.fr?.title,
      thumb: (d) => d.thumbnail,
      fields: [
        { key: 'platform', label: 'Plateforme', type: 'select', options: PLATFORMS },
        { key: 'url', label: 'Lien de la vidéo (https://…)', type: 'text', required: true },
        { key: 'thumbnail', label: 'Miniature', type: 'image', folder: 'videos', publicId: 'thumbnailPublicId' },
        { key: 'fallback', label: 'Image de secours (lien https, facultatif)', type: 'text' },
        { key: 'duration', label: 'Durée (ex. 2:45)', type: 'text' },
        { key: '*', label: 'Titre et description', type: 'langBlock', keys: [['title', 'Titre'], ['desc', 'Description', true]], required: 'title' },
      ],
      defaults: { platform: 'youtube' },
    },
    ads: {
      label: 'Publicités',
      title: (d) => d.title,
      thumb: (d) => d.img,
      fields: [
        { key: 'title', label: 'Nom interne (non affiché)', type: 'text', required: true },
        { key: 'img', label: 'Visuel (format 8:3 conseillé)', type: 'image', folder: 'ads', publicId: 'imgPublicId', required: true },
        { key: 'alt', label: 'Texte alternatif', type: 'langMap' },
        { key: 'link', label: 'Lien au clic (https://… ou /page)', type: 'text' },
        { key: 'startsAt', label: 'Début de diffusion (facultatif)', type: 'date' },
        { key: 'endsAt', label: 'Fin de diffusion (facultatif)', type: 'date' },
      ],
    },
  };

  const BLOCKS = {
    site: 'Coordonnées et réseaux sociaux',
    tagline: 'Slogan',
    subtitle: 'Sous-titre',
    stats: 'Chiffres clés',
    companyIntro: 'Présentation de la société',
    consortium: 'Consortium',
    strategy: 'Stratégie',
    objectives: 'Objectifs',
    operations: 'Opérations',
    investCapacity: 'Capacités d’investissement',
    commitments: 'Engagements',
    africaOpps: 'Opportunités africaines',
    yayeSlides: 'Diaporama Résidence Moderne',
    amenities: 'Commodités Résidence Moderne',
    lotissement: 'Lotissement',
    archPhilosophy: 'Philosophie architecturale',
    materials: 'Matériaux',
    processSteps: 'Services — étapes de la méthode',
    collabBenefits: 'Collaboration — avantages',
    collabTypes: 'Collaboration — types de partenariat',
    expertiseList: 'Collaboration — domaines d’expertise',
    contactSubjects: 'Contact — objets du message',
  };

  const KEY_LABELS = {
    fr: 'Français', en: 'English', es: 'Español', de: 'Deutsch', zh: '中文',
    t: 'Titre', d: 'Description', title: 'Titre', desc: 'Description', tag: 'Étiquette', sub: 'Sous-titre',
    img: 'Image', icon: 'Icône', val: 'Valeur', value: 'Montant', range: 'Fourchette', type: 'Type', country: 'Pays',
    n: 'Numéro', items: 'Éléments', intro: 'Introduction', marble: 'Marbre', name: 'Nom', short: 'Sigle',
    phone: 'Téléphone', whatsapp: 'WhatsApp (chiffres uniquement)', email: 'E-mail', address_fr: 'Adresse',
    social: 'Réseaux sociaux', waMsg: 'Message WhatsApp', facebook: 'Facebook', instagram: 'Instagram',
    tiktok: 'TikTok', threads: 'Threads', linkedin: 'LinkedIn',
  };

  const TARGET_LABELS = { ...Object.fromEntries(Object.entries(COLLECTIONS).map(([k, v]) => [k, v.label])) };
  const ACTION_LABELS = {
    create: 'Création', update: 'Modification', delete: 'Mise à la corbeille', restore: 'Restauration', active: 'Affichage',
    reorder: 'Ordre', sync: 'Synchronisation avec le site', import: 'Import', revert: 'Retour à une version',
  };
  const targetLabel = (t) => (t.startsWith('block:') ? `Texte : ${BLOCKS[t.slice(6)] || t.slice(6)}` : TARGET_LABELS[t] || t);

  // ───────── Champs de formulaire ─────────
  function langTabs(render) {
    const body = h('div');
    const tabs = h('div', { class: 'tabs' });
    const select = (code) => {
      for (const b of tabs.children) b.classList.toggle('on', b.dataset.lang === code);
      body.replaceChildren(render(code));
    };
    for (const [code, name] of LANGS) tabs.append(h('button', { type: 'button', 'data-lang': code, onclick: () => select(code) }, name));
    select('fr');
    return h('div', null, tabs, body);
  }

  function input(value, onChange, { multiline = false, type = 'text', id } = {}) {
    if (multiline) return h('textarea', { id, value: value ?? '', oninput: (e) => onChange(e.target.value) });
    return h('input', { id, type, value: value ?? '', oninput: (e) => onChange(e.target.value) });
  }

  async function uploadImage(folder, file) {
    if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) throw new Error('Format accepté : JPG, PNG, WebP ou AVIF.');
    const sign = await api('/api/admin/uploads/sign', { method: 'POST', body: { folder } });
    if (file.size > sign.maxBytes) throw new Error(`Image trop lourde (maximum ${Math.round(sign.maxBytes / 1048576)} Mo).`);
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', sign.apiKey);
    form.append('timestamp', String(sign.timestamp));
    form.append('signature', sign.signature);
    form.append('folder', sign.folder);
    form.append('allowed_formats', sign.allowedFormats);
    const res = await fetch(sign.uploadUrl, { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.secure_url) throw new Error(data.error?.message || 'Échec de l’envoi de l’image.');
    return { url: data.secure_url, publicId: data.public_id };
  }

  function imageField(value, onChange, folder) {
    const preview = h('img', { alt: '' });
    const text = h('input', { type: 'text', value: value ?? '', placeholder: '/Images/… ou https://…', oninput: (e) => update(e.target.value) });
    const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/avif', class: 'hidden' });
    function update(v, publicId) {
      preview.src = safeImgSrc(v);
      onChange(v, publicId);
    }
    file.addEventListener('change', () => {
      const f = file.files[0];
      if (!f) return;
      guarded(pick, async () => {
        const { url, publicId } = await uploadImage(folder, f);
        text.value = url;
        update(url, publicId);
        toast('Image envoyée.');
      });
      file.value = '';
    });
    const pick = h('button', { type: 'button', class: 'btn light small', onclick: () => file.click() }, 'Envoyer une image…');
    preview.src = safeImgSrc(value);
    return h('div', { class: 'img-field' }, preview, h('div', null, text, h('div', { class: 'row' }, pick, file)));
  }

  /** Construit le formulaire d'une rubrique ; renvoie { el, value() }. */
  function itemForm(spec, doc) {
    const data = clone(doc) || clone(spec.defaults) || {};
    const root = h('div');
    function draw() {
      root.replaceChildren();
      for (const f of spec.fields) {
        if (f.when && !f.when(data)) continue;
        root.append(fieldFor(f));
      }
    }
    function fieldFor(f) {
      const box = h('div', { class: 'field' });
      const label = h('label', null, f.label, f.required ? ' *' : '');
      switch (f.type) {
        case 'select': {
          const opts = f.options.map((o) => (Array.isArray(o) ? o : [o, o]));
          const sel = h('select', { onchange: (e) => { data[f.key] = e.target.value; if (f.key === 'kind') draw(); } }, opts.map(([v, l]) => h('option', { value: v }, l)));
          sel.value = data[f.key] ?? opts[0][0];
          data[f.key] = sel.value;
          box.append(label, sel);
          break;
        }
        case 'color':
          box.append(label, h('input', { type: 'color', value: data[f.key] || '#64748b', oninput: (e) => { data[f.key] = e.target.value; } }));
          break;
        case 'date':
          box.append(label, input(data[f.key] ? String(data[f.key]).slice(0, 10) : '', (v) => { data[f.key] = v || null; }, { type: 'date' }));
          break;
        case 'image':
          box.append(label, imageField(data[f.key], (v, publicId) => {
            data[f.key] = v;
            if (f.publicId) data[f.publicId] = publicId || (v === doc?.[f.key] ? doc?.[f.publicId] || '' : '');
          }, f.folder));
          break;
        case 'langBlock':
          box.append(label, langTabs((lang) => h('div', null, f.keys.map(([k, l, multi]) =>
            h('div', { class: 'field' }, h('label', null, l), input(data[lang]?.[k], (v) => { data[lang] = { ...(data[lang] || {}), [k]: v }; }, { multiline: multi }))))));
          break;
        case 'langMap':
          data[f.key] = data[f.key] || {};
          box.append(label, langTabs((lang) => input(data[f.key][lang], (v) => { data[f.key][lang] = v; }, { multiline: f.multiline })));
          break;
        case 'langStrings':
          box.append(label, langTabs((lang) => input(data[lang], (v) => { data[lang] = v; })));
          break;
        case 'features':
          data.features = data.features || {};
          box.append(label, langTabs((lang) => input((data.features[lang] || []).join('\n'), (v) => {
            data.features[lang] = v.split('\n').map((s) => s.trim()).filter(Boolean);
          }, { multiline: true })));
          break;
        case 'rooms': {
          data.rooms = Array.isArray(data.rooms) ? data.rooms : [];
          const list = h('div');
          const drawRooms = () => {
            list.replaceChildren(...data.rooms.map((room, i) => h('div', { class: 'group-box' },
              h('div', { class: 'head' }, `Pièce ${i + 1}`, h('button', { type: 'button', class: 'btn danger small', onclick: () => { data.rooms.splice(i, 1); drawRooms(); } }, 'Retirer')),
              h('div', { class: 'field' }, h('label', null, 'Surface (ex. 12,50 m²)'), input(room.val, (v) => { room.val = v; })),
              langTabs((lang) => input(room[lang], (v) => { room[lang] = v; })))));
          };
          drawRooms();
          box.append(label, list, h('button', { type: 'button', class: 'btn light small', onclick: () => { data.rooms.push({ fr: '', val: '' }); drawRooms(); } }, '+ Ajouter une pièce'));
          break;
        }
        default:
          box.append(label, input(data[f.key], (v) => { data[f.key] = v; }));
      }
      return box;
    }
    draw();
    return { el: root, value: () => cleanItem(spec, data) };
  }

  /** Retire les langues vides et les champs non concernés avant envoi. */
  function cleanItem(spec, data) {
    const out = {};
    for (const f of spec.fields) {
      if (f.when && !f.when(data)) continue;
      if (f.type === 'langBlock') {
        for (const [lang] of LANGS) {
          const block = Object.fromEntries(Object.entries(data[lang] || {}).filter(([k, v]) => f.keys.some(([key]) => key === k) && String(v ?? '').trim()));
          out[lang] = Object.keys(block).length ? block : lang === 'fr' ? {} : null;
        }
      } else if (f.type === 'langMap') {
        out[f.key] = Object.fromEntries(Object.entries(data[f.key] || {}).filter(([, v]) => String(v ?? '').trim()));
      } else if (f.type === 'langStrings') {
        for (const [lang] of LANGS) out[lang] = String(data[lang] ?? '').trim();
      } else if (f.type === 'features') {
        out.features = Object.fromEntries(Object.entries(data.features || {}).filter(([, list]) => Array.isArray(list) && list.length));
      } else if (f.type === 'rooms') {
        out.rooms = (data.rooms || []).map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => String(v ?? '').trim()))).filter((r) => Object.keys(r).length);
      } else {
        out[f.key] = data[f.key] ?? (f.type === 'date' ? null : '');
        if (f.publicId && data[f.publicId] !== undefined) out[f.publicId] = data[f.publicId];
      }
    }
    if (spec === COLLECTIONS.partners) {
      if (out.kind === 'africa') Object.assign(out, { code: '' });
      else out.name = '';
    }
    return out;
  }

  // ───────── Éditeur générique des blocs de texte ─────────
  function blockEditor(initial) {
    const data = { v: clone(initial) };
    const root = h('div');
    const emptyLike = (v) => {
      if (typeof v === 'string') return '';
      if (typeof v === 'number') return 0;
      if (Array.isArray(v)) return v.length ? [emptyLike(v[0])] : [];
      if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, emptyLike(x)]));
      return v;
    };
    const isImageKey = (key, v) => key === 'img' || (typeof v === 'string' && /^\/Images\//.test(v));

    function node(value, set, key, depth) {
      if (typeof value === 'string') {
        if (isImageKey(key, value)) return imageField(value, (v) => set(v), 'misc');
        return input(value, set, { multiline: value.length > 90 });
      }
      if (typeof value === 'number') return input(String(value), (v) => set(Number(v) || 0), { type: 'number' });
      if (Array.isArray(value)) {
        const box = h('div');
        const draw = () => {
          box.replaceChildren(
            ...value.map((item, i) => h('div', { class: 'group-box' },
              h('div', { class: 'head' }, `Élément ${i + 1}`, h('span', { class: 'row' },
                i > 0 ? h('button', { type: 'button', class: 'btn light small', title: 'Monter', onclick: () => { [value[i - 1], value[i]] = [value[i], value[i - 1]]; draw(); } }, '↑') : null,
                h('button', { type: 'button', class: 'btn danger small', onclick: () => { if (confirm('Retirer cet élément ? (la version actuelle restera dans l’historique)')) { value.splice(i, 1); draw(); } } }, 'Retirer'))),
              node(item, (v) => { value[i] = v; }, key, depth + 1))),
            h('button', { type: 'button', class: 'btn light small', onclick: () => { value.push(value.length ? emptyLike(value[value.length - 1]) : ''); draw(); } }, '+ Ajouter un élément'));
        };
        draw();
        return box;
      }
      if (value && typeof value === 'object') {
        const keys = Object.keys(value);
        const langKeys = keys.filter((k) => LANGS.some(([c]) => c === k));
        const others = keys.filter((k) => !langKeys.includes(k));
        const wrap = h('div');
        for (const k of others) {
          wrap.append(h('div', { class: 'field' }, h('label', null, KEY_LABELS[k] || k), node(value[k], (v) => { value[k] = v; }, k, depth + 1)));
        }
        if (langKeys.length) {
          wrap.append(langTabs((lang) => {
            if (value[lang] === undefined) value[lang] = emptyLike(value.fr);
            return node(value[lang], (v) => { value[lang] = v; }, lang, depth + 1);
          }));
        }
        return wrap;
      }
      return h('span', { class: 'muted' }, '—');
    }
    // Une langue ouverte mais laissée vide n'est pas enregistrée (le site affiche alors le français).
    const isEmptyDeep = (v) => (typeof v === 'string' ? !v.trim() : Array.isArray(v) ? v.every(isEmptyDeep) : v && typeof v === 'object' ? Object.values(v).every(isEmptyDeep) : v === undefined || v === null);
    const prune = (v) => {
      if (Array.isArray(v)) return v.map(prune);
      if (v && typeof v === 'object') {
        const out = {};
        for (const [k, x] of Object.entries(v)) {
          if (k !== 'fr' && LANGS.some(([c]) => c === k) && isEmptyDeep(x)) continue;
          out[k] = prune(x);
        }
        return out;
      }
      return v;
    };
    root.append(node(data.v, (v) => { data.v = v; }, '', 0));
    return { el: root, value: () => prune(data.v) };
  }

  // ───────── Écrans ─────────
  function showLogin(message) {
    const email = h('input', { type: 'email', id: 'email', autocomplete: 'username', required: true });
    const password = h('input', { type: 'password', id: 'password', autocomplete: 'current-password', required: true });
    const error = h('div', { class: message ? 'notice error' : 'hidden' }, message || '');
    const submit = h('button', { type: 'submit', class: 'btn gold' }, 'Se connecter');
    const form = h('form', {
      onsubmit: (e) => {
        e.preventDefault();
        guarded(submit, async () => {
          try {
            const res = await api('/api/auth/login', { method: 'POST', body: { email: email.value.trim(), password: password.value } });
            state.csrf = res.csrfToken;
            state.email = res.admin.email;
            await start();
          } catch (err) {
            error.className = 'notice error';
            error.textContent = err.message;
          }
        });
      },
    },
    h('p', { class: 'eyebrow' }, 'Groupe Ndoye Africa Holding'),
    h('h1', null, 'Administration'),
    error,
    h('div', { class: 'field' }, h('label', { for: 'email' }, 'Adresse e-mail'), email),
    h('div', { class: 'field' }, h('label', { for: 'password' }, 'Mot de passe'), password),
    submit);
    $app.replaceChildren(h('main', { class: 'login' }, form));
    email.focus();
  }

  let $main;
  let $side;
  function shell() {
    const nav = h('nav');
    const link = (hash, label) => h('a', { href: `#/${hash}` }, label);
    nav.append(
      link('', 'Tableau de bord'),
      h('div', { class: 'group' }, 'Contenu'),
      link('textes', 'Textes et coordonnées'),
      ...Object.entries(COLLECTIONS).map(([k, v]) => link(k, v.label)),
      h('div', { class: 'group' }, 'Sécurité des données'),
      link('corbeille', 'Corbeille'),
      link('historique', 'Historique'),
      link('sauvegarde', 'Sauvegarde et import'),
      h('div', { class: 'group' }, 'Compte'),
      link('compte', 'Mot de passe'),
    );
    const logout = h('button', { type: 'button', class: 'btn light small', onclick: () => guarded(logout, async () => {
      await api('/api/auth/logout', { method: 'POST' });
      state.csrf = '';
      showLogin();
    }) }, 'Déconnexion');
    $side = h('aside', { class: 'side' }, h('div', { class: 'brand' }, h('small', null, 'Administration'), 'Groupe Ndoye Africa Holding'), nav);
    $main = h('div');
    const top = h('div', { class: 'topbar' },
      h('button', { type: 'button', class: 'btn light small burger', onclick: () => $side.classList.toggle('open') }, '☰ Menu'),
      h('span', { class: 'muted' }, state.email),
      h('span', { class: 'row' }, h('a', { class: 'btn light small', href: state.siteOrigin, target: '_blank', rel: 'noopener' }, 'Voir le site'), logout));
    $app.replaceChildren(h('div', { class: 'layout' }, $side, h('main', { class: 'main' }, top, $main)));
  }

  function page(title, ...content) {
    $main.replaceChildren(h('h1', null, title), ...content);
    window.scrollTo(0, 0);
  }

  async function viewDashboard() {
    const o = await api('/api/admin/overview');
    const card = (hash, n, label, extra) => h('div', { class: 'card' }, h('a', { href: `#/${hash}` }, h('div', { class: 'n' }, n), label, extra ? h('div', { class: 'muted' }, extra) : null));
    const trashTotal = Object.values(o.trash || {}).reduce((a, b) => a + b, 0);
    page('Tableau de bord',
      h('p', { class: 'muted' }, 'Toutes les modifications sont publiées sur le site en une minute au plus. Rien n’est supprimé définitivement : la corbeille et l’historique permettent de tout rétablir.'),
      h('div', { class: 'cards' },
        card('services', o.services, 'Services'),
        card('villas', o.villas, 'Villas'),
        card('partners', `${o.partnersWorld} + ${o.partnersAfrica}`, 'Partenaires', 'mondiaux + pays africains'),
        card('companies', o.companies, 'Entreprises'),
        card('projects', o.projects, 'Projets'),
        card('gallery', o.gallery, 'Photos'),
        card('videos', o.videos, 'Vidéos'),
        card('ads', o.ads, 'Publicités'),
        card('textes', o.blocks, 'Blocs de texte'),
        card('corbeille', trashTotal, 'Dans la corbeille')),
      h('p'),
      h('h2', null, 'Dernières modifications'),
      historyTable(o.recent || [], false));
  }

  async function viewCollection(name) {
    const spec = COLLECTIONS[name];
    const items = await api(`/api/admin/${name}`);
    const list = h('div', { class: 'list' });
    const move = (i, delta) => guarded(null, async () => {
      const ids = items.map((x) => x.id);
      [ids[i], ids[i + delta]] = [ids[i + delta], ids[i]];
      await api(`/api/admin/${name}/reorder`, { method: 'PUT', body: { ids } });
      route();
    });
    items.forEach((doc, i) => {
      const thumb = spec.thumb ? safeImgSrc(spec.thumb(doc)) : '';
      const toggle = h('button', { type: 'button', class: 'btn light small', onclick: () => guarded(toggle, async () => {
        await api(`/api/admin/${name}/${doc.id}/active`, { method: 'PATCH', body: { active: !doc.active } });
        toast(doc.active ? 'Masqué sur le site.' : 'Affiché sur le site.');
        route();
      }) }, doc.active ? 'Masquer' : 'Afficher');
      const trash = h('button', { type: 'button', class: 'btn danger small', onclick: () => {
        if (!confirm('Mettre cet élément à la corbeille ? Il pourra être restauré à tout moment.')) return;
        guarded(trash, async () => {
          await api(`/api/admin/${name}/${doc.id}`, { method: 'DELETE' });
          toast('Élément mis à la corbeille.');
          route();
        });
      } }, 'Corbeille');
      list.append(h('div', { class: `item${doc.active ? '' : ' off'}` },
        thumb ? h('img', { class: 'thumb', src: thumb, alt: '', loading: 'lazy' }) : h('div', { class: 'thumb' }),
        h('div', { class: 'title' }, spec.title(doc) || '(sans titre)', doc.active ? null : h('span', { class: 'badge off' }, 'masqué')),
        h('div', { class: 'actions row' },
          i > 0 ? h('button', { type: 'button', class: 'btn light small', title: 'Monter', onclick: () => move(i, -1) }, '↑') : null,
          i < items.length - 1 ? h('button', { type: 'button', class: 'btn light small', title: 'Descendre', onclick: () => move(i, 1) }, '↓') : null,
          h('a', { class: 'btn small', href: `#/${name}/${doc.id}` }, 'Modifier'),
          toggle, trash,
          h('a', { class: 'btn light small', href: `#/historique/${name}/${doc.id}` }, 'Historique'))));
    });
    page(spec.label,
      h('div', { class: 'row' }, h('a', { class: 'btn gold', href: `#/${name}/nouveau` }, '+ Ajouter'), h('span', { class: 'muted' }, `${items.length} élément(s) — l’ordre ici est celui du site.`)),
      h('p'), list);
  }

  async function viewItem(name, id) {
    const spec = COLLECTIONS[name];
    const doc = id === 'nouveau' ? null : await api(`/api/admin/${name}/${id}`);
    const form = itemForm(spec, doc);
    const save = h('button', { type: 'button', class: 'btn gold', onclick: () => guarded(save, async () => {
      const body = form.value();
      if (doc) await api(`/api/admin/${name}/${doc.id}`, { method: 'PUT', body });
      else await api(`/api/admin/${name}`, { method: 'POST', body });
      toast('Enregistré. Le site sera à jour dans une minute au plus.');
      location.hash = `#/${name}`;
    }) }, 'Enregistrer');
    page(`${spec.label} — ${doc ? 'modifier' : 'ajouter'}`,
      h('div', { class: 'panel' }, form.el),
      h('div', { class: 'sticky-actions' }, save, h('a', { class: 'btn light', href: `#/${name}` }, 'Annuler')));
  }

  async function viewBlocks() {
    const list = await api('/api/admin/blocks');
    const known = new Map(list.map((b) => [b.key, b.updatedAt]));
    page('Textes et coordonnées',
      h('p', { class: 'muted' }, 'Textes des pages, chiffres clés et coordonnées, dans les 5 langues.'),
      h('div', { class: 'list' }, Object.entries(BLOCKS).map(([key, label]) => h('div', { class: 'item' },
        h('div', { class: 'thumb' }),
        h('div', { class: 'title' }, label, known.has(key) ? h('div', { class: 'muted' }, `Mis à jour le ${fmtDate(known.get(key))}`) : h('span', { class: 'badge off' }, 'non initialisé')),
        h('div', { class: 'actions row' },
          known.has(key) ? h('a', { class: 'btn small', href: `#/textes/${key}` }, 'Modifier') : null,
          h('a', { class: 'btn light small', href: `#/historique/block:${key}` }, 'Historique'))))));
  }

  async function viewBlock(key) {
    const block = await api(`/api/admin/blocks/${key}`);
    const editor = blockEditor(block.data);
    const save = h('button', { type: 'button', class: 'btn gold', onclick: () => guarded(save, async () => {
      await api(`/api/admin/blocks/${key}`, { method: 'PUT', body: { data: editor.value() } });
      toast('Enregistré. Le site sera à jour dans une minute au plus.');
      location.hash = '#/textes';
    }) }, 'Enregistrer');
    page(BLOCKS[key] || key, h('div', { class: 'panel' }, editor.el), h('div', { class: 'sticky-actions' }, save, h('a', { class: 'btn light', href: '#/textes' }, 'Annuler')));
  }

  async function viewTrash() {
    const sections = [];
    for (const [name, spec] of Object.entries(COLLECTIONS)) {
      const items = await api(`/api/admin/${name}?trash=1`);
      if (!items.length) continue;
      sections.push(h('h2', null, spec.label), h('div', { class: 'list' }, items.map((doc) => {
        const restore = h('button', { type: 'button', class: 'btn small', onclick: () => guarded(restore, async () => {
          await api(`/api/admin/${name}/${doc.id}/restore`, { method: 'POST' });
          toast('Élément restauré.');
          route();
        }) }, 'Restaurer');
        const thumb = spec.thumb ? safeImgSrc(spec.thumb(doc)) : '';
        return h('div', { class: 'item' },
          thumb ? h('img', { class: 'thumb', src: thumb, alt: '', loading: 'lazy' }) : h('div', { class: 'thumb' }),
          h('div', { class: 'title' }, spec.title(doc) || '(sans titre)', h('div', { class: 'muted' }, `Mis à la corbeille le ${fmtDate(doc.deletedAt)}`)),
          h('div', { class: 'actions row' }, restore));
      })));
    }
    page('Corbeille',
      h('p', { class: 'muted' }, 'Les éléments retirés du site restent ici et peuvent être restaurés à tout moment. Rien n’est effacé définitivement.'),
      ...(sections.length ? sections : [h('p', null, 'La corbeille est vide.')]));
  }

  function historyTable(items, withRevert = true) {
    if (!items.length) return h('p', { class: 'muted' }, 'Aucune modification enregistrée.');
    return h('table', { class: 'table' },
      h('thead', null, h('tr', null, h('th', null, 'Date'), h('th', null, 'Rubrique'), h('th', null, 'Action'), h('th', null, 'Élément'), h('th', null, 'Par'), withRevert ? h('th', null, '') : null)),
      h('tbody', null, items.map((r) => {
        const isBlock = r.target.startsWith('block:');
        const canRevert = withRevert && (isBlock ? r.action !== 'import' : Boolean(r.docId) || r.action === 'reorder');
        const revert = h('button', { type: 'button', class: 'btn light small', onclick: () => {
          if (!confirm('Rétablir l’état d’avant cette modification ? L’état actuel sera lui-même gardé dans l’historique.')) return;
          guarded(revert, async () => {
            await api(`/api/admin/history/${r.id}/revert`, { method: 'POST' });
            toast('Version rétablie.');
            route();
          });
        } }, 'Rétablir l’état d’avant');
        return h('tr', null,
          h('td', null, fmtDate(r.createdAt)),
          h('td', null, targetLabel(r.target)),
          h('td', null, ACTION_LABELS[r.action] || r.action),
          h('td', null, r.label || ''),
          h('td', { class: 'muted' }, r.by || ''),
          withRevert ? h('td', null, canRevert ? revert : '') : null);
      })));
  }

  async function viewHistory(target, docId, pageNo = 1) {
    const params = new URLSearchParams({ page: String(pageNo) });
    if (target) params.set('target', target);
    if (docId) params.set('docId', docId);
    const res = await api(`/api/admin/history?${params}`);
    const nav = h('div', { class: 'row' },
      pageNo > 1 ? h('button', { type: 'button', class: 'btn light small', onclick: () => viewHistory(target, docId, pageNo - 1) }, '← Plus récentes') : null,
      res.items.length === 50 ? h('button', { type: 'button', class: 'btn light small', onclick: () => viewHistory(target, docId, pageNo + 1) }, 'Plus anciennes →') : null);
    page(target ? `Historique — ${targetLabel(target)}` : 'Historique',
      h('p', { class: 'muted' }, 'Chaque modification garde une copie de l’état précédent, qui peut être rétabli.'),
      target ? h('p', null, h('a', { href: '#/historique' }, 'Voir tout l’historique')) : null,
      historyTable(res.items), h('p'), nav);
  }

  function viewBackup() {
    const download = h('button', { type: 'button', class: 'btn gold', onclick: () => guarded(download, async () => {
      const data = await api('/api/admin/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = h('a', { href: url, download: `gnah-sauvegarde-${data.exportedAt.slice(0, 10)}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }) }, 'Télécharger une sauvegarde');
    const report = h('div');
    const file = h('input', { type: 'file', accept: 'application/json,.json' });
    const send = h('button', { type: 'button', class: 'btn', onclick: () => guarded(send, async () => {
      const f = file.files[0];
      if (!f) throw new Error('Choisissez d’abord un fichier.');
      if (f.size > 4.5 * 1048576) throw new Error('Fichier trop volumineux (4,5 Mo au maximum).');
      let data;
      try {
        data = JSON.parse(await f.text());
      } catch {
        throw new Error('Ce fichier n’est pas un fichier JSON valide.');
      }
      const r = await api('/api/admin/import', { method: 'POST', body: { data } });
      const lines = [h('p', null, `${r.added} élément(s) ajouté(s), ${r.ignored} déjà présent(s) — rien n’a été remplacé.`)];
      if (r.settings) {
        lines.push(h('p', null, 'Anciens paramètres trouvés (ils n’étaient pas publiés sur le site) ; recopiez-les dans « Textes et coordonnées » si besoin :'),
          h('ul', null, Object.entries(r.settings).map(([k, v]) => h('li', null, `${KEY_LABELS[k] || k} : ${v}`))));
      }
      if (r.errors?.length) lines.push(h('p', null, 'Éléments non importés :'), h('ul', null, r.errors.map((e) => h('li', null, e))));
      report.replaceChildren(h('div', { class: r.errors?.length ? 'notice' : 'notice ok' }, lines));
    }) }, 'Importer');
    page('Sauvegarde et import',
      h('div', { class: 'panel' }, h('h2', null, 'Sauvegarder'), h('p', { class: 'muted' }, 'Fichier contenant tout le contenu du site, corbeille comprise (jamais les mots de passe). Conservez-le en lieu sûr.'), download),
      h('div', { class: 'panel' }, h('h2', null, 'Importer'),
        h('p', { class: 'muted' }, 'Accepte une sauvegarde de cette administration, ou le fichier « gnah-ancien-tableau-de-bord.json » téléchargé depuis groupendoyeafrica.com/admin sur l’appareil utilisé avec l’ancien tableau de bord. Seuls les éléments absents sont ajoutés : rien n’est remplacé ni supprimé.'),
        h('div', { class: 'row' }, file, send), h('p'), report));
  }

  function viewAccount() {
    const cur = h('input', { type: 'password', autocomplete: 'current-password' });
    const n1 = h('input', { type: 'password', autocomplete: 'new-password' });
    const n2 = h('input', { type: 'password', autocomplete: 'new-password' });
    const save = h('button', { type: 'button', class: 'btn gold', onclick: () => guarded(save, async () => {
      if (n1.value !== n2.value) throw new Error('Les deux nouveaux mots de passe ne correspondent pas.');
      const r = await api('/api/auth/password', { method: 'PUT', body: { currentPassword: cur.value, newPassword: n1.value } });
      state.csrf = r.csrfToken;
      cur.value = n1.value = n2.value = '';
      toast('Mot de passe modifié. Les autres sessions ont été déconnectées.');
    }) }, 'Changer le mot de passe');
    page('Mot de passe', h('div', { class: 'panel' },
      h('p', { class: 'muted' }, 'Au moins 12 caractères, avec majuscules, minuscules, chiffres et symboles.'),
      h('div', { class: 'field' }, h('label', null, 'Mot de passe actuel'), cur),
      h('div', { class: 'field' }, h('label', null, 'Nouveau mot de passe'), n1),
      h('div', { class: 'field' }, h('label', null, 'Confirmer le nouveau mot de passe'), n2),
      save));
  }

  // ───────── Navigation ─────────
  async function route() {
    if (!$main) return;
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    $side.classList.remove('open');
    for (const a of $side.querySelectorAll('nav a')) a.classList.toggle('on', a.getAttribute('href') === `#/${parts[0] || ''}`);
    const [section, a, b] = parts;
    await guarded(null, async () => {
      if (!section) return viewDashboard();
      if (section === 'textes') return a && BLOCKS[a] ? viewBlock(a) : viewBlocks();
      if (section === 'corbeille') return viewTrash();
      if (section === 'historique') return viewHistory(a, b);
      if (section === 'sauvegarde') return viewBackup();
      if (section === 'compte') return viewAccount();
      if (COLLECTIONS[section]) return a ? viewItem(section, a) : viewCollection(section);
      location.hash = '#/';
      return undefined;
    });
  }

  async function start() {
    const cfg = await api('/api/admin/config').catch(() => null);
    if (cfg?.siteOrigin) state.siteOrigin = cfg.siteOrigin;
    shell();
    await route();
  }

  window.addEventListener('hashchange', route);

  // Reprise de session après un rechargement de page.
  (async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (!res.ok) return showLogin();
      const me = await res.json();
      state.csrf = me.csrfToken;
      state.email = me.admin.email;
      return start();
    } catch {
      return showLogin('Serveur injoignable. Réessayez dans un instant.');
    }
  })();
})();
