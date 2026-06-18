/**
 * The Literary Nexus – Core JavaScript Application
 * Vanilla JS ES6+  |  Accessible  |  Performance-Optimised
 *
 * Key fixes vs. previous version:
 *   1. Wrapped in IIFE – no global `App` const → fixes "Identifier 'App' already declared"
 *   2. loadEventData()  → falls back to assets/data/event.json   (fixes 402 on mocki.io)
 *   3. loadAuthorData() → falls back to assets/data/authors.json (fixes 402 on mocki.io)
 *   4. requestIdleCallback used for non-critical work
 */

(function () {
    'use strict';

    /* ── Local data paths (always-available fallbacks) ─────────────────── */
    const LOCAL_EVENT   = 'assets/data/event.json';
    const LOCAL_AUTHORS = 'assets/data/authors.json';
    const API_RSVP      = 'https://httpbin.org/post';

    /* ── App state ─────────────────────────────────────────────────────── */
    const state = {
        eventDate:         null,
        countdownInterval: null
    };

    /* ════════════════════════════════════════════════════════════════════
       INIT
    ════════════════════════════════════════════════════════════════════ */
    function init() {
        setupNavigation();
        loadEventData();
        loadAuthorData();
        setupRSVPForm();
        /* Lazy-loading is non-critical; defer until browser is idle */
        if ('requestIdleCallback' in window) {
            requestIdleCallback(setupLazyLoading);
        } else {
            setTimeout(setupLazyLoading, 200);
        }
    }

    /* ════════════════════════════════════════════════════════════════════
       1. NAVIGATION – Smooth scroll + accessible focus shift
    ════════════════════════════════════════════════════════════════════ */
    function setupNavigation() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', e => {
                const targetId = anchor.getAttribute('href');
                if (targetId === '#') return;
                e.preventDefault();
                const target = document.querySelector(targetId);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    target.setAttribute('tabindex', '-1');
                    target.focus({ preventScroll: true });
                }
            });
        });
    }

    /* ════════════════════════════════════════════════════════════════════
       2. EVENT DATA + COUNTDOWN
          Primary source : assets/data/event.json  (local – always works)
          No external API call → eliminates the 402 error
    ════════════════════════════════════════════════════════════════════ */
    async function loadEventData() {
        try {
            const response = await fetch(LOCAL_EVENT);
            if (!response.ok) throw new Error(`Event JSON fetch failed: ${response.status}`);
            const data = await response.json();

            /* Optionally update hero title */
            const heroTitle = document.querySelector('#hero h1');
            if (heroTitle && data.eventName) {
                heroTitle.textContent = `The Literary Nexus Presents: ${data.eventName}`;
            }

            if (data.eventDate) {
                let targetDate = new Date(data.eventDate);
                /* If the stored date has already passed, push it 30 days forward */
                if (targetDate < new Date()) {
                    targetDate = new Date();
                    targetDate.setDate(targetDate.getDate() + 30);
                }
                state.eventDate = targetDate;
                startCountdown(targetDate);
            } else {
                fallbackCountdown();
            }
        } catch (err) {
            console.warn('loadEventData error:', err);
            fallbackCountdown();
        }
    }

    function startCountdown(targetDate) {
        const display   = document.getElementById('countdown-timer');
        const srDisplay = document.getElementById('sr-countdown-timer');
        if (!display) return;

        /* One-time, static description for screen readers */
        if (srDisplay) {
            srDisplay.textContent = `The event commences on ${targetDate.toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            })}.`;
        }

        function tick() {
            const distance = targetDate.getTime() - Date.now();
            if (distance < 0) {
                clearInterval(state.countdownInterval);
                display.textContent = 'Event Has Commenced';
                return;
            }
            const d = Math.floor(distance / 86_400_000);
            const h = Math.floor((distance % 86_400_000) / 3_600_000);
            const m = Math.floor((distance % 3_600_000) / 60_000);
            const s = Math.floor((distance % 60_000) / 1_000);
            display.textContent = `${d}d ${h}h ${m}m ${s}s`;
        }

        tick();
        state.countdownInterval = setInterval(tick, 1000);
    }

    function fallbackCountdown() {
        const d = new Date();
        d.setDate(d.getDate() + 14);
        startCountdown(d);
    }

    /* ════════════════════════════════════════════════════════════════════
       3. AUTHOR DATA
          Primary source : assets/data/authors.json  (local – always works)
    ════════════════════════════════════════════════════════════════════ */
    async function loadAuthorData() {
        const grid = document.querySelector('.authors-grid');
        if (!grid) return;

        grid.innerHTML = '<p class="authors-status-message">Loading featured literary guests…</p>';

        try {
            const response = await fetch(LOCAL_AUTHORS);
            if (!response.ok) throw new Error(`Authors JSON fetch failed: ${response.status}`);
            const users = await response.json();

            grid.innerHTML = '';
            users.slice(0, 3).forEach(user => grid.appendChild(createAuthorCard(user)));
            setupAccordion();
            setupLazyLoading(); /* re-observe any newly added lazy images */
        } catch (err) {
            console.warn('loadAuthorData error:', err);
            grid.innerHTML = '<p class="authors-status-message authors-status-error">Unable to load author profiles. Please refresh.</p>';
        }
    }

    /* ════════════════════════════════════════════════════════════════════
       4. AUTHOR CARD BUILDER
    ════════════════════════════════════════════════════════════════════ */
    function createAuthorCard(user) {
        const card       = document.createElement('article');
        card.className   = 'author-card';
        card.id          = `author-${user.id}`;

        const name       = escapeHTML(user.name);
        const email      = escapeHTML(user.email);
        const snippet    = escapeHTML(user.company?.catchPhrase ?? '');
        const fullBio    = escapeHTML(user.company?.bs ?? '');
        const photoUrl   = `https://picsum.photos/id/${user.id}/200/200`;
        /* 1×1 transparent SVG placeholder – avoids a network request for the placeholder */
        const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3C/svg%3E";

        card.innerHTML = `
            <img data-src="${photoUrl}"
                 src="${placeholder}"
                 alt="Portrait photo of ${name}"
                 class="author-photo lazy-image"
                 width="200" height="200"
                 loading="lazy">
            <h3 class="author-name">${name}</h3>
            <p class="author-email">
                <a href="mailto:${email}" aria-label="Send email to ${name}">${email}</a>
            </p>
            <p class="author-bio-snippet">${snippet}</p>
            <button type="button"
                    aria-expanded="false"
                    aria-controls="bio-detail-${user.id}"
                    class="bio-toggle-btn">View Full Profile</button>
            <div id="bio-detail-${user.id}" class="bio-full-content" hidden>
                <h4>Full Biography</h4>
                <p>${fullBio}</p>
            </div>`;

        return card;
    }

    /* Simple HTML-escaping to prevent XSS from API data */
    function escapeHTML(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /* ════════════════════════════════════════════════════════════════════
       5. ACCORDION – Bio expand / collapse
    ════════════════════════════════════════════════════════════════════ */
    function setupAccordion() {
        document.querySelectorAll('.bio-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId  = btn.getAttribute('aria-controls');
                const panel     = document.getElementById(targetId);
                if (!panel) return;

                const isExpanded = btn.getAttribute('aria-expanded') === 'true';
                btn.setAttribute('aria-expanded', String(!isExpanded));
                panel.hidden    = isExpanded;
                btn.textContent = isExpanded ? 'View Full Profile' : 'Hide Full Profile';

                if (!isExpanded) {
                    panel.classList.add('bio-fade-in');
                } else {
                    panel.classList.remove('bio-fade-in');
                }
            });
        });
    }

    /* ════════════════════════════════════════════════════════════════════
       6. RSVP FORM SUBMISSION
    ════════════════════════════════════════════════════════════════════ */
    function setupRSVPForm() {
        const form = document.getElementById('rsvp-form');
        if (!form) return;
        const statusEl = document.getElementById('rsvp-status');

        form.addEventListener('submit', async e => {
            e.preventDefault();
            const btn          = form.querySelector('.submit-button');
            const originalText = btn.textContent;

            const dataObject = Object.fromEntries(new FormData(form).entries());

            btn.disabled    = true;
            btn.textContent = 'Submitting…';

            if (statusEl) {
                statusEl.textContent = '';
                statusEl.className = 'rsvp-status';
            }

            try {
                const res = await fetch(API_RSVP, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(dataObject)
                });
                if (!res.ok) throw new Error(`RSVP endpoint error: ${res.status}`);
                await res.json();
                
                if (statusEl) {
                    statusEl.textContent = `RSVP Confirmed! We look forward to seeing you, ${dataObject.name}.`;
                    statusEl.className = 'rsvp-status status-success';
                }
                form.reset();
            } catch (err) {
                console.error('RSVP submission error:', err);
                if (statusEl) {
                    statusEl.textContent = 'We encountered an issue processing your reservation. Please try again.';
                    statusEl.className = 'rsvp-status status-error';
                }
            } finally {
                btn.disabled    = false;
                btn.textContent = originalText;
            }
        });
    }

    /* ════════════════════════════════════════════════════════════════════
       7. LAZY LOADING – IntersectionObserver
    ════════════════════════════════════════════════════════════════════ */
    function setupLazyLoading() {
        const images = document.querySelectorAll('img.lazy-image[data-src]');
        if (!images.length) return;

        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries, obs) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    const img  = entry.target;
                    img.src    = img.dataset.src;
                    img.onload = () => img.classList.add('fade-in');
                    img.onerror = function() {
                        this.onerror = null;
                        this.src = 'assets/images/author-fallback.svg';
                    };
                    img.classList.remove('lazy-image');
                    obs.unobserve(img);
                });
            }, { rootMargin: '200px' });

            images.forEach(img => observer.observe(img));
        } else {
            /* Fallback for browsers without IntersectionObserver */
            images.forEach(img => {
                img.src = img.dataset.src;
                img.onerror = function() {
                    this.onerror = null;
                    this.src = 'assets/images/author-fallback.svg';
                };
                img.classList.remove('lazy-image');
            });
        }
    }

    /* ── Bootstrap on DOM ready ────────────────────────────────────────── */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init(); /* DOMContentLoaded already fired (script loaded late / defer) */
    }

}());
