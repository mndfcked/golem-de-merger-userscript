// ==UserScript==
// @name         Golem.de: Article Merger
// @namespace    https://github.com/mndfcked/golem-de-merger-userscript
// @version      1.0.1
// @description  Merges paginated Golem.de articles into a single page for easier reading. Supports merging in-place, opening in a new tab, or sending to Readwise.
// @author       Joern D.
// @license      MIT
// @match        https://www.golem.de/news/*
// @icon         https://www.golem.de/favicon.ico
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @homepageURL  https://github.com/mndfcked/golem-de-merger-userscript
// @supportURL   https://github.com/mndfcked/golem-de-merger-userscript/issues
// @updateURL    https://raw.githubusercontent.com/mndfcked/golem-de-merger-userscript/main/golem-onepager.user.js
// @downloadURL  https://raw.githubusercontent.com/mndfcked/golem-de-merger-userscript/main/golem-onepager.user.js
// ==/UserScript==

(async () => {
  'use strict';

  // ======== CONFIGURATION ========

  /**
   * If true, automatically merges the article on page load.
   * @type {boolean}
   */
  const AUTO_MERGE = false;

  /**
   * Maximum number of pages to merge to prevent excessive requests.
   * @type {number}
   */
  const MAX_PAGES = 30;

  // ======== SELECTORS & CONSTANTS ========

  const ARTICLE_SELECTORS = [
    'main article',
    'article.article',
    'article',
    '.article__body',
    '.article-content',
    '.content',
    '#content',
  ];
  const PAGINATION_LIST_SELECTOR = '.go-pagination__list';
  const PAGINATION_LINK_SELECTOR = 'a.gsnw-link__article-pagination';

  // ======== STYLES ========

  const STYLES = {
    MERGE_BUTTON: `
      .gm-merge-btn {
        position: fixed;
        right: 18px;
        z-index: 2147483647;
        padding: 8px 12px;
        border-radius: 6px;
        border: none;
        background: #0b72e0;
        color: white;
        cursor: pointer;
        font-size: 13px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        transition: background-color 0.2s;
      }
      .gm-merge-btn:hover { background: #095db7; }
      .gm-merge-btn:disabled { background: #555; cursor: wait; }
    `,
    MERGED_CONTENT: `
      .gm-merged-sep {
        margin: 28px 0;
        border: none;
        border-top: 1px solid #ccc;
      }
      .gm-merged-label {
        text-align: center;
        opacity: 0.75;
        font-size: 0.9em;
        margin: 10px 0 18px;
      }
      .gm-merged-label a {
        margin-left: 8px;
        font-size: 0.8em;
        opacity: 0.8;
      }
    `,
    NEW_TAB_VIEW: `
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; margin: 20px; color: #222; }
      article { max-width: 900px; margin: 0 auto; }
      h1 { font-size: 2em; margin-bottom: 0.5em; }
      img, video { max-width: 100%; height: auto; }
    `,
    INFO_POPUP: `
      .gm-info-popup {
        position: fixed;
        right: 18px;
        bottom: 72px;
        background: #222;
        color: #fff;
        padding: 8px 12px;
        border-radius: 6px;
        z-index: 2147483647;
        font-size: 14px;
      }
    `,
    SETTINGS_MENU: `
      #golem-settings-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 2147483646;
        display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      .golem-settings-modal {
        background: white; border-radius: 8px; padding: 20px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        max-width: 400px;
      }
      .golem-settings-modal h3 { margin-top: 0; color: #0b72e0; }
      .golem-settings-modal p { margin: 8px 0; font-size: 13px; color: #666; }
      .golem-settings-modal button {
        padding: 6px 12px; color: white; border: none;
        border-radius: 4px; cursor: pointer; margin-right: 8px; font-size: 12px;
      }
      #golem-token-action { background: #0b72e0; }
      #golem-token-clear { background: #d32f2f; }
      #golem-settings-close { background: #999; }
    `
  };

  // ======== DOM & UTILITY HELPERS ========

  /**
   * Queries a single element.
   * @param {Document|Element} doc - The document or element to query within.
   * @param {string} sel - The CSS selector.
   * @returns {Element|null}
   */
  function q(doc, sel) { return doc.querySelector(sel); }

  /**
   * Queries multiple elements and returns them as an array.
   * @param {Document|Element} doc - The document or element to query within.
   * @param {string} sel - The CSS selector.
   * @returns {Element[]}
   */
  function qa(doc, sel) { return Array.from(doc.querySelectorAll(sel)); }

  /**
   * Parses an HTML string into a Document.
   * @param {string} text - The HTML string.
   * @returns {Document}
   */
  function parseHTML(text) { return new DOMParser().parseFromString(text, 'text/html'); }

  /**
   * Converts a relative URL to an absolute URL.
   * @param {string} href - The URL to resolve.
   * @returns {string|null}
   */
  function absUrl(href) { try { return new URL(href, location.href).href; } catch (e) { return null; } }

  /**
   * Escapes a string for safe use in HTML.
   * @param {string} s - The string to escape.
   * @returns {string}
   */
  function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ======== STORAGE MANAGEMENT ========

  const gm_storage_present = typeof GM_getValue !== 'undefined' && typeof GM_setValue !== 'undefined' && typeof GM_deleteValue !== 'undefined';
  if (!gm_storage_present) {
    console.warn('Golem.de merger: GM_* storage functions not found. Falling back to localStorage. This may happen in a scratchpad environment.');
  }

  /**
   * Retrieves the stored Readwise token.
   * @returns {Promise<string|null>}
   */
  async function getStoredToken() {
    try {
      if (gm_storage_present) return await GM_getValue('readwise_token', null);
      return localStorage.getItem('readwise_token');
    } catch (e) {
      console.warn('Storage access error:', e);
      return null;
    }
  }

  /**
   * Saves the Readwise token.
   * @param {string} token - The token to save.
   * @returns {Promise<boolean>} - True if successful.
   */
  async function saveToken(token) {
    try {
      if (token && token.trim()) {
        const trimmedToken = token.trim();
        if (gm_storage_present) {
          await GM_setValue('readwise_token', trimmedToken);
        } else {
          localStorage.setItem('readwise_token', trimmedToken);
        }
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Storage save error:', e);
      return false;
    }
  }

  /**
   * Clears the stored Readwise token.
   * @returns {Promise<boolean>} - True if successful.
   */
  async function clearStoredToken() {
    try {
      if (gm_storage_present) {
        await GM_deleteValue('readwise_token');
      } else {
        localStorage.removeItem('readwise_token');
      }
      return true;
    } catch (e) {
      console.warn('Storage delete error:', e);
      return false;
    }
  }

  /**
   * Prompts the user for their Readwise token and saves it.
   * @returns {Promise<string|null>} The token if provided and saved, otherwise null.
   */
  async function promptForToken() {
    const token = prompt('Enter your Readwise access token (from readwise.io/access_token):\n\n(Token will be stored for future use)');
    if (token && token.trim()) {
      if (await saveToken(token)) {
        return token.trim();
      }
    }
    return null;
  }


  // ======== ARTICLE & PAGE PARSING ========

  /**
   * Finds the main article element on the page.
   * @param {Document} doc - The document to search in.
   * @returns {Element|null}
   */
  function selectFirstArticle(doc) {
    for (const sel of ARTICLE_SELECTORS) {
      const el = doc.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  /**
   * Extracts the page number from a Golem.de article URL.
   * Fixes issue where article IDs were misinterpreted as page numbers.
   * @param {string} url - The URL to parse.
   * @returns {number} The page number (defaults to 1).
   */
  function pageNumberFromUrl(url) {
    if (!url) return 1;
    const match = url.match(/-(\d+)\.html$/i);
    if (!match) return 1;

    const matchedPart = `-${match[1]}.html`;
    const idx = url.lastIndexOf(matchedPart);
    if (idx === -1) return 1;

    const before = url.slice(0, idx);
    // If the part before "-N.html" has another hyphen, it's likely a multi-page article.
    if (before.includes('-')) {
      const num = parseInt(match[1], 10);
      // Safeguard against huge numbers (likely article IDs).
      if (isFinite(num) && num < 1000) {
        return num;
      }
    }
    return 1; // Otherwise, assume it's page 1.
  }

  /**
   * Extracts all pagination URLs from the current document.
   * @param {Document} doc - The document to search for pagination links.
   * @returns {string[]} An array of unique, absolute URLs.
   */
  function extractPaginationUrlsFromDom(doc) {
    const urls = new Set();
    const lists = qa(doc, PAGINATION_LIST_SELECTOR);
    for (const list of lists) {
      const anchors = qa(list, PAGINATION_LINK_SELECTOR).concat(qa(list, 'a'));
      for (const a of anchors) {
        const href = a.getAttribute('href');
        if (href) {
          const fullUrl = absUrl(href);
          if (fullUrl) urls.add(fullUrl);
        }
      }
    }
    return Array.from(urls);
  }

  /**
   * A fallback method to find pagination links if the primary selector fails.
   * @param {Document} doc - The document to search.
   * @returns {string[]} An array of unique, absolute URLs.
   */
  function fallbackDetectPaginationLinks(doc) {
    const anchors = qa(doc, 'a[href]');
    const base = location.origin;
    const matches = anchors
      .map(a => absUrl(a.getAttribute('href')))
      .filter(h => h && h.startsWith(base) && /\/news\/.+-?\d*\.html$/i.test(h));
    return Array.from(new Set(matches));
  }

  // ======== CONTENT FETCHING & CLEANUP ========

  /**
   * Fetches a URL and parses it into a DOM document.
   * @param {string} url - The URL to fetch.
   * @returns {Promise<Document>}
   */
  async function fetchDocument(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`Fetch failed: ${url} — ${res.status}`);
    const text = await res.text();
    return parseHTML(text);
  }

  /**
   * Extracts the main article content from a document, excluding the title.
   * @param {Document} doc - The document to extract from.
   * @returns {DocumentFragment|null}
   */
  function extractArticleFragment(doc) {
    const articleEl = selectFirstArticle(doc);
    if (!articleEl) return null;

    const fragment = document.createDocumentFragment();
    for (const child of Array.from(articleEl.children)) {
      // Exclude the main H1 title, as we keep the original one.
      if (child.tagName && child.tagName.toLowerCase() === 'h1') continue;
      fragment.appendChild(child.cloneNode(true));
    }
    cleanupFragment(fragment);
    return fragment;
  }

  /**
   * Removes unwanted elements like ads, social buttons, and related links from a fragment.
   * @param {DocumentFragment|Element} fragment - The content to clean.
   */
  function cleanupFragment(fragment) {
    const selectorsToRemove = [
      '.go-button-bar',
      '.go-teaser-block',
      '.go-pagination',
      '.go-gallery__actions',
    ];
    selectorsToRemove.forEach(sel => qa(fragment, sel).forEach(n => n.remove()));

    // Remove ad slots and their parent containers
    qa(fragment, '.go-ad-slot').forEach(adSlot => adSlot.parentElement?.remove());

    // Remove "Reklame" (advertisement) link lists
    qa(fragment, '.go-alink-list').forEach(list => {
      if (q(list, '.go-alink__label')?.textContent.trim() === 'Reklame') {
        list.remove();
      }
    });

    // Simplify galleries to only show the active image
    qa(fragment, '.go-gallery__wrapper').forEach(wrapper => {
      qa(wrapper, '.go-gallery__item[data-active="false"]').forEach(item => item.remove());
    });
  }

  /**
   * Converts all relative URLs (in images, links, etc.) to absolute ones.
   * @param {DocumentFragment|Element} fragment - The content to process.
   */
  function convertRelativeUrlsToAbsolute(fragment) {
    qa(fragment, 'img[src]').forEach(el => el.setAttribute('src', absUrl(el.getAttribute('src'))));
    qa(fragment, 'a[href]').forEach(el => el.setAttribute('href', absUrl(el.getAttribute('href'))));
    qa(fragment, 'source[src]').forEach(el => el.setAttribute('src', absUrl(el.getAttribute('src'))));
    qa(fragment, 'video[poster]').forEach(el => el.setAttribute('poster', absUrl(el.getAttribute('poster'))));

    qa(fragment, 'img[srcset], source[srcset]').forEach(el => {
      const newSrcset = el.getAttribute('srcset').split(',').map(part => {
        const [url, descriptor] = part.trim().split(/\s+/, 2);
        return `${absUrl(url) || url}${descriptor ? ' ' + descriptor : ''}`;
      }).join(', ');
      el.setAttribute('srcset', newSrcset);
    });
  }

  // ======== MERGE & RENDER LOGIC ========

  /**
   * Appends a merged page fragment to the main article.
   * @param {Element} mainArticle - The primary article element.
   * @param {DocumentFragment} fragment - The content to append.
   * @param {number} pageNum - The page number of the fragment.
   * @param {string} pageUrl - The original URL of the fragment.
   */
  function appendFragmentToMain(mainArticle, fragment, pageNum, pageUrl) {
    const separator = document.createElement('hr');
    separator.className = 'gm-merged-sep';

    const label = document.createElement('div');
    label.className = 'gm-merged-label';
    label.innerHTML = `— Seite ${pageNum} — <a href="${escapeHtml(pageUrl)}" target="_blank" rel="noopener">Originalseite</a>`;

    mainArticle.appendChild(separator);
    mainArticle.appendChild(label);
    mainArticle.appendChild(fragment);
  }

  /**
   * Removes all pagination UI elements from the page.
   */
  function removePaginationUI() {
    const selectorsToRemove = [
      PAGINATION_LIST_SELECTOR,
      '.pagination', '.paginator', 'nav.pagination',
      '.page-nav', '.article-pages', '.go-pagination'
    ];
    selectorsToRemove.forEach(sel => qa(document, sel).forEach(n => n.remove()));

    qa(document, 'a').forEach(a => {
      if (/^(Nächste|Vorherige|Next|Previous|Seite)\b/i.test(a.textContent.trim())) {
        a.closest('p, div, nav')?.remove();
      }
    });
  }

  /**
   * Builds the full HTML for the "merge to new tab" feature.
   * @param {string} titleText - The article title.
   * @param {string} headExtras - Extra elements to inject into the <head>.
   * @param {string} mergedBodyHtml - The merged HTML content of the article body.
   * @returns {string} A full HTML document string.
   */
  function buildMergedHtmlDocument(titleText, headExtras, mergedBodyHtml) {
    return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(titleText || 'Merged Article')}</title>
<style>${STYLES.NEW_TAB_VIEW}${STYLES.MERGED_CONTENT}</style>
${headExtras || ''}
</head>
<body><article>${mergedBodyHtml}</article></body>
</html>`;
  }

  /**
   * Sends the merged article content to the Readwise API.
   * @param {string} mergedHtml - The HTML content of the merged article.
   * @param {string} titleText - The article title.
   * @param {string} pageUrl - The original URL of the first page.
   * @returns {Promise<boolean>} True on success, false on failure.
   */
  async function sendToReadwise(mergedHtml, titleText, pageUrl) {
    let token = await getStoredToken();
    if (!token) {
      token = await promptForToken();
    }
    if (!token) {
      alert('Readwise token required.');
      return false;
    }

    const payload = {
      url: pageUrl,
      html: `<article>${mergedHtml}</article>`,
      should_clean_html: true,
      title: titleText || 'Merged Article',
      author: q(document, 'meta[name="author"]')?.getAttribute('content'),
      summary: q(document, 'meta[name="description"]')?.getAttribute('content'),
      image_url: q(document, 'meta[property="og:image"]')?.getAttribute('content'),
      published_date: q(document, 'meta[property="article:published_time"]')?.getAttribute('content'),
      category: 'article',
      saved_using: 'Golem.de Merge Userscript',
      location: 'new',
      tags: ['golem.de']
    };

    try {
      const res = await fetch('https://readwise.io/api/v3/save/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Readwise API error (${res.status}): ${errText}`);
      }

      const result = await res.json();
      alert(`Successfully saved to Readwise!\nDocument ID: ${result.id}`);
      return true;
    } catch (err) {
      console.error('Readwise save error:', err);
      alert('Error saving to Readwise: ' + (err.message || err));
      return false;
    }
  }

  /**
   * The main routine to find, fetch, and merge all pages of an article.
   * @param {object} options - The options for the merge operation.
   * @param {boolean} [options.openInNewTab=false] - If true, opens the merged article in a new tab.
   * @param {boolean} [options.saveToReadwise=false] - If true, sends the article to Readwise.
   */
  async function mergePages({ openInNewTab = false, saveToReadwise = false } = {}) {
    const startUrl = location.href;
    const mainArticle = selectFirstArticle(document);
    if (!mainArticle) {
      alert('Could not find the main article element. The page layout might have changed.');
      return;
    }

    // Find all page URLs
    let pageUrls = extractPaginationUrlsFromDom(document);
    if (pageUrls.length === 0) pageUrls = fallbackDetectPaginationLinks(document);

    // Sort URLs by page number and remove duplicates
    pageUrls = Array.from(new Set(pageUrls.map(absUrl).filter(Boolean)));
    if (!pageUrls.includes(startUrl)) pageUrls.unshift(startUrl);
    pageUrls.sort((a, b) => pageNumberFromUrl(a) - pageNumberFromUrl(b));
    pageUrls = pageUrls.slice(0, MAX_PAGES);

    const mergedFragmentsHtml = [];
    let mergedCount = 0;
    const titleEl = q(document, 'h1');
    const titleHtml = titleEl ? titleEl.outerHTML : '';

    // Fetch and process each page
    for (const url of pageUrls) {
      const pageNum = pageNumberFromUrl(url);
      try {
        const doc = (url === startUrl) ? document : await fetchDocument(url);
        const frag = extractArticleFragment(doc);

        if (frag?.childElementCount > 0) {
          convertRelativeUrlsToAbsolute(frag);

          if (openInNewTab || saveToReadwise) {
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(frag);
            const separatorHtml = pageNum > 1
              ? `<hr class="gm-merged-sep"><div class="gm-merged-label">— Seite ${pageNum} — <a href="${escapeHtml(url)}" target="_blank" rel="noopener">Originalseite</a></div>`
              : '';
            mergedFragmentsHtml.push(separatorHtml + tempDiv.innerHTML);
          } else if (pageNum > 1) {
            appendFragmentToMain(mainArticle, frag, pageNum, url);
          }
          mergedCount++;
        } else {
          console.warn('No article fragment found at', url);
        }
      } catch (e) {
        console.warn('Failed to fetch/parse page', url, e);
      }
    }

    // Finalize based on selected mode
    if (openInNewTab || saveToReadwise) {
      const mergedBodyHtml = titleHtml + mergedFragmentsHtml.join('\n');
      if (saveToReadwise) {
        await sendToReadwise(mergedBodyHtml, titleEl?.textContent, startUrl);
      } else {
        const mergedHtml = buildMergedHtmlDocument(titleEl?.textContent, '', mergedBodyHtml);
        const blob = new Blob([mergedHtml], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      }
    } else {
      removePaginationUI();
    }

    showInfoPopup(`Merged ${mergedCount} page(s).`);
  }

  // ======== UI COMPONENTS ========

  /**
   * Creates a button for the UI.
   * @param {string} text - The button text.
   * @param {number} bottom - The bottom offset in pixels.
   * @returns {HTMLButtonElement}
   */
  function createButton(text, bottom) {
    const btn = document.createElement('button');
    btn.className = 'gm-merge-btn';
    btn.textContent = text;
    btn.style.bottom = `${bottom}px`;
    return btn;
  }

  /**
   * Shows a temporary info message on the screen.
   * @param {string} message - The message to display.
   */
  function showInfoPopup(message) {
    const info = document.createElement('div');
    info.className = 'gm-info-popup';
    info.textContent = message;
    document.body.appendChild(info);
    setTimeout(() => info.remove(), 3200);
  }

  /**
   * Displays the settings menu modal.
   */
  async function showSettingsMenu() {
    const hasToken = !!(await getStoredToken());
    const menuContainer = document.createElement('div');
    menuContainer.id = 'golem-settings-overlay';
    menuContainer.innerHTML = `
      <div class="golem-settings-modal">
        <h3>Golem Merger Settings</h3>
        <div>
          <strong>Readwise Token:</strong>
          <p>${hasToken ? '✓ Token stored' : '✗ No token stored'}</p>
          <button id="golem-token-action">${hasToken ? 'Change Token' : 'Set Token'}</button>
          ${hasToken ? '<button id="golem-token-clear">Clear Token</button>' : ''}
        </div>
        <hr style="border:none; border-top:1px solid #eee; margin: 20px 0;">
        <button id="golem-settings-close">Close</button>
      </div>
    `;
    document.body.appendChild(menuContainer);

    q(menuContainer, '#golem-settings-close').addEventListener('click', () => menuContainer.remove());
    q(menuContainer, '#golem-token-action').addEventListener('click', async () => {
      if (await promptForToken()) {
        alert('Token updated successfully.');
        menuContainer.remove();
        // Re-render menu if needed, but closing is simpler
      }
    });

    const clearBtn = q(menuContainer, '#golem-token-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear the stored Readwise token?')) {
          await clearStoredToken();
          alert('Token cleared.');
          menuContainer.remove();
        }
      });
    }
  }

  /**
   * Initializes the UI and sets up event listeners.
   */
  function init() {
    // Don't run on pages without pagination
    if (!q(document, PAGINATION_LIST_SELECTOR)) {
      return;
    }

    // Inject all styles
    [STYLES.MERGE_BUTTON, STYLES.MERGED_CONTENT, STYLES.INFO_POPUP, STYLES.SETTINGS_MENU].forEach(style => GM_addStyle(style));

    const buttons = [
      { text: 'Merge pages', bottom: 18, action: () => mergePages({}) },
      { text: 'Merge → new tab', bottom: 62, action: () => mergePages({ openInNewTab: true }) },
      { text: 'Merge → Readwise', bottom: 106, action: () => mergePages({ saveToReadwise: true }) },
      { text: '⚙', bottom: 150, action: showSettingsMenu },
    ];

    const createdButtons = [];

    buttons.forEach(b => {
      const btn = createButton(b.text, b.bottom);
      btn.addEventListener('click', async () => {
        if (b.action.name.includes('mergePages')) {
          btn.disabled = true;
          btn.textContent = 'Merging…';
          try {
            await b.action();
            btn.textContent = 'Done!';
            // Remove all merge-related buttons after a successful merge
            createdButtons.forEach(b => b.remove());
          } catch (err) {
            console.error('Merge failed:', err);
            alert('An error occurred during merge: ' + (err.message || err));
            btn.disabled = false;
            btn.textContent = b.text;
          }
        } else {
          b.action();
        }
      });
      document.body.appendChild(btn);
      if (b.action.name.includes('mergePages')) {
        createdButtons.push(btn);
      }
    });

    if (AUTO_MERGE) {
      setTimeout(() => createdButtons[0].click(), 800);
    }
  }

  // ======== SCRIPT EXECUTION ========

  init();

})();
