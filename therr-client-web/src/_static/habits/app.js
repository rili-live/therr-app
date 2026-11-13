/* eslint-env browser */
/**
 * Friends with Habits on the web (habits.therr.com/app).
 *
 * A small, dependency-free client for the parts of the mobile app that matter to someone
 * who cannot or will not install it: see today's habits, check in, open a habit's detail,
 * answer pact invitations, and ask to join an open pact. It talks to the same gateway
 * endpoints the mobile app does, with the session habits/login.hbs writes to storage.
 *
 * Plain script rather than part of the React bundle on purpose: the habits host serves
 * self-contained Handlebars pages and ships no bundle, and the people this is for are on
 * a phone browser, often on a first visit. It is served from src/_static with a long
 * immutable cache, so the shell (views/habits/app.hbs) references it with a content-hash
 * query string; see utilities/habitsApp.ts.
 *
 * The pure helpers at the top are exported for Jest (src/__tests__/habitsApp.test.ts) when
 * a CommonJS `module` exists; in the browser nothing is exported and `start()` runs.
 *
 * Every string a person reads comes from the dictionary the shell injects
 * (src/habitsAppLocales). Text is always set through textContent, never innerHTML: habit
 * names, notes and usernames are other people's input.
 */
(function habitsWebApp(root) {
    const APP_BASE = '/app';
    const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.therr.habits';
    const SESSION_KEYS = ['therrSession', 'therrUser', 'therrRefreshToken'];
    const CALENDAR_WEEKS = 5;
    const TEMPLATE_LIMIT = 12;

    // ---------------------------------------------------------------------------------
    // Pure helpers
    // ---------------------------------------------------------------------------------

    /** The viewer's own calendar day as YYYY-MM-DD. Never toISOString(): that is UTC's day. */
    const toLocalDateKey = (date) => {
        const pad = (value) => String(value).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    };

    /** A check-in's habit day. The API sends a date or a full timestamp; only the day matters. */
    const toDateKey = (value) => (typeof value === 'string' ? value.slice(0, 10) : '');

    /** Dictionary lookup with {placeholder} substitution. A miss returns the key, visibly. */
    const translate = (dictionary, key, params) => {
        const value = key.split('.').reduce(
            (node, part) => (node && typeof node === 'object' ? node[part] : undefined),
            dictionary,
        );
        if (typeof value !== 'string') {
            return key;
        }
        return value.replace(/\{(\w+)\}/g, (match, name) => (
            params && params[name] !== undefined && params[name] !== null ? String(params[name]) : match
        ));
    };

    /**
     * Maps a pathname under /app to a view. Anything unrecognised is the today view, so a
     * mistyped or stale link still lands somewhere useful.
     */
    const parseRoute = (pathname) => {
        const path = (pathname || '').replace(/\/+$/, '');
        const habitMatch = path.match(/^\/app\/habits\/([0-9a-fA-F-]{8,64})$/);
        if (habitMatch) {
            return { name: 'habit', habitGoalId: habitMatch[1] };
        }
        if (path === '/app/discover') {
            return { name: 'discover' };
        }
        return { name: 'today' };
    };

    /**
     * Same-origin paths only. Control characters and backslashes are refused outright:
     * browsers strip tab, CR and LF from a URL, so '/\t/host' would otherwise pass a
     * pattern check and then be followed as '//host'.
     */
    const isSafeReturnPath = (value) => typeof value === 'string'
        && /^\/(?!\/)/.test(value)
        // eslint-disable-next-line no-control-regex -- matching control characters is the point
        && !/[\u0000-\u0020\\]/.test(value);

    const greetingKey = (hour) => {
        if (hour < 12) {
            return 'today.greetingMorning';
        }
        return hour < 18 ? 'today.greetingAfternoon' : 'today.greetingEvening';
    };

    const memberName = (member) => (member && (member.firstName || member.userName)) || '';

    /** The other people in the user's live pacts on one habit, with whether each is done today. */
    const getPartners = (pacts, habitGoalId, userId) => {
        const seen = {};
        const partners = [];
        (pacts || []).forEach((pact) => {
            if (pact.habitGoalId !== habitGoalId) {
                return;
            }
            (pact.members || []).forEach((member) => {
                if (member.userId === userId || seen[member.userId]) {
                    return;
                }
                if (member.status !== 'active' && member.status !== 'pending') {
                    return;
                }
                seen[member.userId] = true;
                partners.push({
                    userId: member.userId,
                    name: memberName(member),
                    isPending: member.status === 'pending',
                    checkedInToday: !!member.checkedInToday,
                    currentStreak: Number(member.currentStreak) || 0,
                    completionRate: Number(member.completionRate) || 0,
                });
            });
        });
        return partners;
    };

    /**
     * One line about the partners on a habit card. The partner is the point of the product,
     * so the card says whether they have shown up today rather than only naming them.
     */
    const describePartners = (dictionary, partners) => {
        const active = partners.filter((partner) => !partner.isPending && partner.name);
        if (!active.length) {
            return '';
        }
        if (active.length === 1) {
            return translate(dictionary, active[0].checkedInToday ? 'habit.partnerDone' : 'habit.partnerNotYet', {
                name: active[0].name,
            });
        }
        return translate(dictionary, 'habit.withPartners', {
            names: active.length === 2
                ? `${active[0].name}, ${active[1].name}`
                : translate(dictionary, 'habit.andOthers', { name: active[0].name, count: active.length - 1 }),
        });
    };

    const describeCadence = (dictionary, frequencyType, frequencyCount) => {
        const count = Number(frequencyCount) || 0;
        if (frequencyType === 'weekly' && count > 0 && count < 7) {
            return translate(dictionary, 'habit.cadenceWeekly', { count });
        }
        if (frequencyType === 'custom') {
            return translate(dictionary, 'habit.cadenceCustom');
        }
        return translate(dictionary, 'habit.cadenceDaily');
    };

    /**
     * The last `weeks` weeks as rows of seven days, Monday first, ending with the week that
     * holds `todayKey`. A day is done when a completed check-in exists for it; days after
     * today are flagged so the grid can leave them blank rather than read as missed.
     */
    const buildCalendar = (todayKey, checkins, weeks) => {
        const done = {};
        (checkins || []).forEach((checkin) => {
            if (checkin.status === 'completed') {
                done[toDateKey(checkin.scheduledDate)] = true;
            }
        });
        const [year, month, day] = todayKey.split('-').map(Number);
        const today = new Date(year, month - 1, day);
        const mondayOffset = (today.getDay() + 6) % 7;
        const start = new Date(year, month - 1, day - mondayOffset - (weeks - 1) * 7);
        const rows = [];
        for (let week = 0; week < weeks; week += 1) {
            const row = [];
            for (let weekday = 0; weekday < 7; weekday += 1) {
                const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + week * 7 + weekday);
                const key = toLocalDateKey(date);
                row.push({
                    key,
                    dayOfMonth: date.getDate(),
                    isDone: !!done[key],
                    isToday: key === todayKey,
                    isFuture: key > todayKey,
                });
            }
            rows.push(row);
        }
        return rows;
    };

    /** Not yet done first, so the top of the list is what still needs a tap. */
    const sortHabitsForToday = (habits, doneByGoalId) => habits
        .map((habit, index) => ({ habit, index }))
        .sort((a, b) => {
            const aDone = doneByGoalId[a.habit.habitGoalId] ? 1 : 0;
            const bDone = doneByGoalId[b.habit.habitGoalId] ? 1 : 0;
            return aDone - bDone || a.index - b.index;
        })
        .map((entry) => entry.habit);

    const isIosDevice = (userAgent, maxTouchPoints) => /iPhone|iPad|iPod/.test(userAgent || '')
        || (/Macintosh/.test(userAgent || '') && maxTouchPoints > 1);

    const helpers = {
        buildCalendar,
        describeCadence,
        describePartners,
        getPartners,
        greetingKey,
        isIosDevice,
        isSafeReturnPath,
        parseRoute,
        sortHabitsForToday,
        toDateKey,
        toLocalDateKey,
        translate,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = helpers;
        return;
    }

    // ---------------------------------------------------------------------------------
    // Browser runtime
    // ---------------------------------------------------------------------------------

    const { document } = root;
    const boot = root.HABITS_APP || {};
    const dictionary = boot.dictionary || {};
    const apiBase = boot.apiBase || '';
    const localeCode = boot.locale || 'en-us';
    const t = (key, params) => translate(dictionary, key, params);

    const noop = () => undefined;
    // Painters and the router call each other (a check-in repaints the list that holds its
    // button), so they live on one object instead of depending on declaration order.
    const views = { latestTodayState: null };

    const viewEl = document.getElementById('app-view');
    const toastEl = document.getElementById('app-toast');

    let timeZone;
    try {
        timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
        timeZone = undefined;
    }
    const isIos = isIosDevice(root.navigator.userAgent, root.navigator.maxTouchPoints);

    const track = (name, params) => {
        try {
            if (typeof root.gtag === 'function') {
                root.gtag('event', name, { surface: 'web_app', ...(params || {}) });
            }
        } catch (e) { /* analytics must never break the app */ }
    };

    // ---- session ----

    const readStored = (key) => {
        try {
            return root.sessionStorage.getItem(key) || root.localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    };

    const writeStored = (key, value) => {
        try { root.sessionStorage.setItem(key, value); } catch (e) { /* storage disabled */ }
        try { root.localStorage.setItem(key, value); } catch (e) { /* storage disabled */ }
    };

    const readUser = () => {
        try {
            const parsed = JSON.parse(readStored('therrUser') || 'null');
            return parsed && parsed.idToken && parsed.id ? parsed : null;
        } catch (e) {
            return null;
        }
    };

    let user = readUser();

    const goToLogin = () => {
        // Clear first: a dead token left in storage would bounce login straight back here.
        SESSION_KEYS.forEach((key) => {
            try { root.sessionStorage.removeItem(key); } catch (e) { /* storage disabled */ }
            try { root.localStorage.removeItem(key); } catch (e) { /* storage disabled */ }
        });
        const here = root.location.pathname;
        root.location.assign(`/login?returnTo=${encodeURIComponent(isSafeReturnPath(here) ? here : APP_BASE)}`);
    };

    // ---- api ----

    const rawRequest = (method, path, body) => root.fetch(apiBase + path, {
        method,
        headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${user.idToken}`,
            'x-userid': user.id,
            'x-brand-variation': 'habits',
            'x-localecode': localeCode,
        },
        body: body ? JSON.stringify(body) : undefined,
    }).then((res) => res.json().catch(() => ({})).then((json) => ({ ok: res.ok, status: res.status, body: json })));

    // One refresh at a time: the today view fires five requests together, and five
    // concurrent refreshes would each rotate the token out from under the others.
    //
    // Resolves 'ok', 'invalid' (the server refused the refresh token: the session is over)
    // or 'unavailable' (offline, rate-limited, or a server error: the session may be fine,
    // so it must not be thrown away).
    let refreshInFlight = null;
    const refreshSession = () => {
        if (refreshInFlight) {
            return refreshInFlight;
        }
        const refreshToken = readStored('therrRefreshToken');
        if (!refreshToken) {
            return Promise.resolve('invalid');
        }
        refreshInFlight = root.fetch(`${apiBase}/users-service/auth/token/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-brand-variation': 'habits' },
            body: JSON.stringify({ refreshToken }),
        })
            .then((res) => res.json().catch(() => ({})).then((json) => {
                if (!res.ok) {
                    return res.status === 400 || res.status === 401 || res.status === 403 ? 'invalid' : 'unavailable';
                }
                if (!json.idToken) {
                    return 'unavailable';
                }
                user = { ...user, idToken: json.idToken };
                if (json.refreshToken) {
                    user.refreshToken = json.refreshToken;
                    writeStored('therrRefreshToken', json.refreshToken);
                }
                writeStored('therrUser', JSON.stringify(user));
                return 'ok';
            }))
            .catch(() => 'unavailable')
            .then((outcome) => {
                refreshInFlight = null;
                return outcome;
            });
        return refreshInFlight;
    };

    /**
     * Resolves `{ ok, status, body }` for any HTTP answer and rejects only on a network
     * failure. A 401 is retried once behind a token refresh. Only a refresh the server
     * refuses ends the session (the user is sent to sign in, returning to this page); a
     * refresh that could not be made at all answers like a network error, so the view
     * offers a retry and the stored session survives.
     */
    const request = (method, path, body) => rawRequest(method, path, body).then((out) => {
        if (out.status !== 401) {
            return out;
        }
        return refreshSession().then((outcome) => {
            if (outcome === 'invalid') {
                goToLogin();
                return new Promise(noop); // navigating away; leave the caller pending
            }
            if (outcome === 'unavailable') {
                return { ok: false, status: 0, body: { message: t('common.networkError') } };
            }
            return rawRequest(method, path, body);
        });
    });

    const withTimeZone = (path) => (timeZone
        ? `${path}${path.indexOf('?') === -1 ? '?' : '&'}timeZone=${encodeURIComponent(timeZone)}`
        : path);

    const errorMessage = (out) => (out && out.body && typeof out.body.message === 'string' && out.body.message)
        || t('common.genericError');

    // ---- dom ----

    /** h('div', { class: 'x', onclick: fn }, child, 'text') — text is always a text node. */
    const h = (tag, attrs, ...children) => {
        const el = document.createElement(tag);
        Object.keys(attrs || {}).forEach((name) => {
            const value = attrs[name];
            if (value === undefined || value === null || value === false) {
                return;
            }
            if (name.indexOf('on') === 0 && typeof value === 'function') {
                el.addEventListener(name.slice(2), value);
            } else if (value === true) {
                el.setAttribute(name, '');
            } else {
                el.setAttribute(name, String(value));
            }
        });
        children.forEach((child) => {
            if (child === undefined || child === null || child === false) {
                return;
            }
            el.appendChild(typeof child === 'string' || typeof child === 'number'
                ? document.createTextNode(String(child))
                : child);
        });
        return el;
    };

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const icon = (pathData, className) => {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2.2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.setAttribute('aria-hidden', 'true');
        if (className) {
            svg.setAttribute('class', className);
        }
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', pathData);
        svg.appendChild(path);
        return svg;
    };
    const ICON_CHECK = 'M5 12.5l4.5 4.5L19 7.5';
    const ICON_FLAME = 'M13 2s1 3.5-1 6c-1.3 1.6-3 2.4-3 5a5 5 0 0 0 10 0c0-4-3-5-3-8 0 0-1 1.5-2 2-1-2-1-5-1-5z';
    const ICON_BACK = 'M15 5l-7 7 7 7';

    let toastTimer = null;
    const toast = (message, kind) => {
        toastEl.textContent = message;
        toastEl.className = `app-toast${kind === 'error' ? ' app-toast--error' : ''}`;
        toastEl.hidden = false;
        if (toastTimer) {
            root.clearTimeout(toastTimer);
        }
        toastTimer = root.setTimeout(() => { toastEl.hidden = true; }, 4200);
    };

    const setView = (...nodes) => {
        viewEl.textContent = '';
        nodes.forEach((node) => node && viewEl.appendChild(node));
    };

    const renderLoading = () => setView(h(
        'div',
        { class: 'app-skeleton', role: 'status', 'aria-label': t('common.loading') },
        h('div', { class: 'app-skeleton__block app-skeleton__block--tall' }),
        h('div', { class: 'app-skeleton__block' }),
        h('div', { class: 'app-skeleton__block' }),
        h('div', { class: 'app-skeleton__block' }),
    ));

    const renderError = (message, retry) => setView(h(
        'div',
        { class: 'app-state', role: 'alert' },
        h('p', { class: 'app-state__body' }, message),
        h('button', { class: 'btn btn--primary', type: 'button', onclick: retry }, t('common.retry')),
    ));

    // ---- routing ----

    const navigate = (path) => {
        if (root.location.pathname !== path) {
            root.history.pushState({}, '', path);
        }
        views.renderRoute();
        root.scrollTo(0, 0);
    };

    /** An in-app link: a real href (so it can be opened in a new tab) routed client-side. */
    const link = (path, attrs, ...children) => h('a', {
        ...attrs,
        href: path,
        onclick: (event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button) {
                return;
            }
            event.preventDefault();
            navigate(path);
        },
    }, ...children);

    const setActiveTab = (name) => {
        Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'), (tab) => {
            if (tab.getAttribute('data-tab') === name) {
                tab.setAttribute('aria-current', 'page');
            } else {
                tab.removeAttribute('aria-current');
            }
        });
    };

    // ---- shared pieces ----

    const streakPill = (count) => {
        const streak = Number(count) || 0;
        return h(
            'span',
            { class: `pill${streak > 0 ? ' pill--streak' : ''}` },
            streak > 0 ? icon(ICON_FLAME, 'pill__icon') : null,
            streak > 0 ? t('habit.streak', { count: streak }) : t('habit.streakNone'),
        );
    };

    /**
     * Posts today's check-in for one habit. Resolves with the created check-in, or null
     * after telling the user why not (free-tier cap, solo grace ended, network).
     */
    // The user's day as the server reckons it: the account's saved zone wins over the
    // browser's, so a traveller's browser can be a day off. Learned from the daily-streak
    // read; the browser's day is only the fallback until then.
    const currentDayKey = () => views.serverToday || toLocalDateKey(new Date());

    const submitCheckin = (habit, notes) => {
        const today = currentDayKey();
        return request('POST', '/users-service/habits/checkins', {
            habitGoalId: habit.habitGoalId,
            scheduledDate: today,
            localDate: today,
            timeZone,
            status: 'completed',
            ...(notes ? { notes } : {}),
        }).then((out) => {
            if (!out.ok) {
                toast(errorMessage(out), 'error');
                return null;
            }
            track('habit_checkin_complete', { has_note: !!notes });
            toast(out.body.streakSavedByFreeze
                ? t('habit.freezeUsedToast')
                : t('habit.checkedInToast', { habit: habit.goalName }));
            return out.body;
        }).catch(() => {
            toast(t('common.networkError'), 'error');
            return null;
        });
    };

    // Habits with a check-in in flight. A repaint (another habit's check-in finishing) builds
    // new buttons, and without this one would come back enabled mid-request and could be
    // submitted twice.
    const pendingCheckins = {};

    const checkinButton = (habit, isDone, onDone, onFail) => {
        if (isDone) {
            return h(
                'span',
                { class: 'checkin-btn checkin-btn--done', role: 'img', 'aria-label': t('habit.checkedIn') },
                icon(ICON_CHECK),
            );
        }
        const isPending = !!pendingCheckins[habit.habitGoalId];
        const button = h('button', {
            class: `checkin-btn${isPending ? ' is-busy' : ''}`,
            type: 'button',
            disabled: isPending,
            'aria-label': t(habit.pause ? 'habit.checkInPausedAria' : 'habit.checkInAria', { habit: habit.goalName }),
            onclick: (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (pendingCheckins[habit.habitGoalId]) {
                    return;
                }
                pendingCheckins[habit.habitGoalId] = true;
                button.disabled = true;
                button.classList.add('is-busy');
                submitCheckin(habit).then((checkin) => {
                    delete pendingCheckins[habit.habitGoalId];
                    if (checkin) {
                        onDone(checkin);
                    } else if (onFail) {
                        onFail();
                    } else {
                        button.disabled = false;
                        button.classList.remove('is-busy');
                    }
                });
            },
        }, icon(ICON_CHECK));
        return button;
    };

    const shareInvite = () => {
        const url = `https://habits.therr.com/invite${user.userName ? `/${encodeURIComponent(user.userName)}` : ''}`;
        track('invite_share_click');
        if (root.navigator.share) {
            root.navigator.share({ title: t('share.shareTitle'), text: t('share.shareText'), url }).catch(noop);
            return;
        }
        if (root.navigator.clipboard) {
            root.navigator.clipboard.writeText(url).then(() => toast(t('share.copied'))).catch(() => root.prompt('', url));
            return;
        }
        root.prompt('', url);
    };

    const growthCards = () => h(
        'div',
        { class: 'growth' },
        h(
            'section',
            { class: 'card card--tint' },
            h('h2', { class: 'card__title' }, t('share.heading')),
            h('p', { class: 'card__body' }, t('share.body')),
            h('button', { class: 'btn btn--primary', type: 'button', onclick: shareInvite }, t('share.cta')),
        ),
        h(
            'section',
            { class: 'card' },
            h('h2', { class: 'card__title' }, t('getApp.heading')),
            h('p', { class: 'card__body' }, isIos ? t('getApp.iosBody') : t('getApp.body')),
            isIos ? null : h('a', {
                class: 'btn btn--secondary',
                href: PLAY_STORE_URL,
                rel: 'noopener',
                onclick: () => track('store_click', { location: 'web_app' }),
            }, t('getApp.cta')),
        ),
    );

    // ---- today ----

    const renderToday = () => {
        setActiveTab('today');
        renderLoading();

        Promise.all([
            request('GET', withTimeZone('/users-service/habits/user-habits?status=active')),
            request('GET', withTimeZone('/users-service/habits/checkins/today')),
            request('GET', '/users-service/habits/pacts/active'),
            request('GET', '/users-service/habits/pacts/invites'),
            request('GET', withTimeZone('/users-service/habits/daily-streak/me')),
        ]).then(([habitsOut, checkinsOut, pactsOut, invitesOut, streakOut]) => {
            if (!habitsOut.ok) {
                renderError(errorMessage(habitsOut), renderToday);
                return;
            }
            // Everything but the habit list is garnish: a failed streak or invite read must
            // not cost the user the check-in buttons.
            const state = {
                habits: (habitsOut.body && habitsOut.body.userHabits) || [],
                checkins: checkinsOut.ok && Array.isArray(checkinsOut.body) ? checkinsOut.body : [],
                pacts: pactsOut.ok && Array.isArray(pactsOut.body) ? pactsOut.body : [],
                invites: invitesOut.ok && Array.isArray(invitesOut.body) ? invitesOut.body : [],
                streak: streakOut.ok ? streakOut.body : null,
            };
            if (state.streak && /^\d{4}-\d{2}-\d{2}$/.test(state.streak.today || '')) {
                views.serverToday = state.streak.today;
            }
            track('web_app_view', { view: 'today', habit_count: state.habits.length });
            views.paintToday(state);
        }).catch(() => renderError(t('common.networkError'), renderToday));
    };

    const inviterNames = {};

    const inviteCard = (invite, state) => {
        const actions = h('div', { class: 'invite__actions' });
        const answer = (verb, successKey) => {
            Array.prototype.forEach.call(actions.querySelectorAll('button'), (button) => button.setAttribute('disabled', ''));
            request('PUT', `/users-service/habits/pacts/${invite.id}/${verb}`).then((out) => {
                if (!out.ok) {
                    toast(errorMessage(out), 'error');
                    Array.prototype.forEach.call(actions.querySelectorAll('button'), (button) => button.removeAttribute('disabled'));
                    return;
                }
                track(verb === 'accept' ? 'pact_invite_accept' : 'pact_invite_decline');
                toast(t(successKey));
                if (verb === 'accept') {
                    renderToday();
                } else {
                    views.paintToday({ ...state, invites: state.invites.filter((other) => other.id !== invite.id) });
                }
            }).catch(() => {
                toast(t('common.networkError'), 'error');
                Array.prototype.forEach.call(actions.querySelectorAll('button'), (button) => button.removeAttribute('disabled'));
            });
        };
        actions.appendChild(h('button', {
            class: 'btn btn--primary btn--small', type: 'button', onclick: () => answer('accept', 'invites.accepted'),
        }, t('invites.accept')));
        actions.appendChild(h('button', {
            class: 'btn btn--quiet btn--small', type: 'button', onclick: () => answer('decline', 'invites.declined'),
        }, t('invites.decline')));

        const knownName = inviterNames[invite.id];
        const title = h('p', { class: 'invite__title' }, knownName ? t('invites.from', { name: knownName }) : t('invites.fromUnknown'));
        // The invite list carries no member rows, so the inviter's name is one read away.
        // Best-effort, and once per invite: the list repaints after every check-in.
        if (knownName === undefined) {
            inviterNames[invite.id] = '';
            request('GET', `/users-service/habits/pacts/${invite.id}`).then((out) => {
                const creator = out.ok && (out.body.members || []).find((member) => member.userId === out.body.creatorUserId);
                if (memberName(creator)) {
                    inviterNames[invite.id] = memberName(creator);
                    title.textContent = t('invites.from', { name: inviterNames[invite.id] });
                }
            }).catch(noop);
        }

        return h(
            'li',
            { class: 'invite' },
            h('span', { class: 'habit__emoji', 'aria-hidden': 'true' }, invite.habitGoalEmoji || '🤝'),
            h(
                'div',
                { class: 'invite__text' },
                title,
                h('p', { class: 'invite__detail' }, t('invites.detail', {
                    habit: invite.habitGoalName || '',
                    days: invite.durationDays || 30,
                })),
                actions,
            ),
        );
    };

    const habitCard = (habit, state, doneByGoalId) => {
        const isDone = !!doneByGoalId[habit.habitGoalId];
        const partners = getPartners(state.pacts, habit.habitGoalId, user.id);
        const isAwaiting = !!habit.pendingPactId && !partners.some((partner) => !partner.isPending);
        let partnerLine = describePartners(dictionary, partners);
        if (habit.pause) {
            // Checking in ends the pause (the server resumes the habit), so say so up front.
            partnerLine = t('habit.pausedHint');
        } else if (!partnerLine) {
            partnerLine = isAwaiting ? t('habit.awaitingPartner') : t('habit.solo');
        }
        const progress = habit.weekProgress;
        const weekDone = progress ? Number(progress.done) + (isDone ? 1 : 0) : 0;

        return h(
            'li',
            { class: `habit${isDone ? ' habit--done' : ''}` },
            link(
                `${APP_BASE}/habits/${habit.habitGoalId}`,
                { class: 'habit__main', 'aria-label': t('habit.viewDetails', { habit: habit.goalName }) },
                h('span', { class: 'habit__emoji', 'aria-hidden': 'true' }, habit.goalEmoji || '✅'),
                h(
                    'span',
                    { class: 'habit__text' },
                    h('span', { class: 'habit__name' }, habit.goalName),
                    h('span', { class: 'habit__partner' }, partnerLine),
                    h(
                        'span',
                        { class: 'habit__meta' },
                        streakPill(habit.currentStreak),
                        progress && Number(progress.target) > 0 && Number(progress.target) < 7
                            ? h('span', { class: 'pill' }, t('habit.weekProgress', {
                                done: Math.min(weekDone, Number(progress.target)),
                                target: progress.target,
                            }))
                            : null,
                    ),
                ),
            ),
            checkinButton(habit, isDone, (checkin) => {
                // Repaint first so the tap feels instant, then let the server have the last
                // word on the streak: whether a check-in extends it depends on the habit's
                // cadence and on freezes, which only the server knows.
                //
                // From what is on screen now, not from `state`: that is the snapshot this card
                // was drawn from, and another check-in may have repainted the list since.
                const current = views.latestTodayState || state;
                const nextState = {
                    ...current,
                    checkins: current.checkins.concat([checkin]),
                    streak: checkin.dailyStreak && typeof checkin.dailyStreak.currentStreak === 'number'
                        ? { ...(current.streak || {}), ...checkin.dailyStreak, isAtStakeToday: false }
                        : current.streak,
                };
                if (parseRoute(root.location.pathname).name !== 'today') {
                    return;
                }
                views.paintToday(nextState);
                request('GET', withTimeZone('/users-service/habits/user-habits?status=active')).then((out) => {
                    // Only if the user is still looking at this list.
                    if (out.ok && out.body.userHabits && parseRoute(root.location.pathname).name === 'today') {
                        views.paintToday({ ...views.latestTodayState, habits: out.body.userHabits });
                    }
                }).catch(noop);
            }, () => {
                // Failed: repaint so the button this card now shows comes back enabled.
                if (parseRoute(root.location.pathname).name === 'today' && views.latestTodayState) {
                    views.paintToday(views.latestTodayState);
                }
            }),
        );
    };

    const streakCard = (state, doneCount) => {
        const { streak } = state;
        const total = state.habits.length;
        const initials = t('today.weekdayInitials').split(',');
        const week = streak && Array.isArray(streak.week) ? streak.week : [];
        let progressText = '';
        if (total > 0) {
            progressText = doneCount >= total
                ? t('today.progressAllDone', { total })
                : t('today.progress', { done: doneCount, total });
        }

        return h(
            'section',
            { class: 'streak-card' },
            h(
                'div',
                { class: 'streak-card__main' },
                h(
                    'div',
                    { class: 'streak-card__count' },
                    icon(ICON_FLAME, 'streak-card__flame'),
                    h('span', { class: 'streak-card__number' }, String((streak && Number(streak.currentStreak)) || 0)),
                    h('span', { class: 'streak-card__label' }, t('today.streakLabel')),
                ),
                progressText ? h('p', { class: 'streak-card__progress' }, progressText) : null,
                streak && streak.isAtStakeToday
                    ? h('p', { class: 'streak-card__warn' }, t('today.streakAtStake'))
                    : null,
            ),
            week.length === 7 ? h(
                'ol',
                { class: 'week', 'aria-label': t('today.weekAriaLabel') },
                ...week.map((dayEntry, index) => h(
                    'li',
                    { class: `week__day week__day--${dayEntry.status}${dayEntry.isToday ? ' is-today' : ''}` },
                    h('span', { class: 'week__dot' }, dayEntry.status === 'upheld' ? icon(ICON_CHECK) : null),
                    h('span', { class: 'week__initial', 'aria-hidden': 'true' }, initials[index] || ''),
                )),
            ) : null,
        );
    };

    views.paintToday = (state) => {
        // Kept so a late background refresh merges into what is on screen rather than into
        // the snapshot its request was started from.
        views.latestTodayState = state;
        const doneByGoalId = {};
        state.checkins.forEach((checkin) => {
            if (checkin.status === 'completed') {
                doneByGoalId[checkin.habitGoalId] = true;
            }
        });
        const name = user.firstName || user.userName || t('today.greetingFallbackName');
        const doneCount = state.habits.filter((habit) => doneByGoalId[habit.habitGoalId]).length;
        const sorted = sortHabitsForToday(state.habits, doneByGoalId);

        setView(
            h('h1', { class: 'app-title' }, t(greetingKey(new Date().getHours()), { name })),
            streakCard(state, doneCount),
            state.invites.length ? h(
                'section',
                { class: 'section' },
                h('h2', { class: 'section__title' }, t('today.invitesHeading')),
                h('ul', { class: 'list' }, ...state.invites.map((invite) => inviteCard(invite, state))),
            ) : null,
            state.habits.length ? h(
                'section',
                { class: 'section' },
                h('h2', { class: 'section__title' }, t('today.habitsHeading')),
                h('ul', { class: 'list' }, ...sorted.map((habit) => habitCard(habit, state, doneByGoalId))),
            ) : h(
                'section',
                { class: 'app-state' },
                h('h2', { class: 'app-state__title' }, t('empty.title')),
                h('p', { class: 'app-state__body' }, t('empty.body')),
                link(`${APP_BASE}/discover`, { class: 'btn btn--primary' }, t('empty.cta')),
            ),
            growthCards(),
        );
    };

    // ---- habit detail ----

    const renderHabit = (habitGoalId) => {
        setActiveTab('today');
        renderLoading();
        // The range runs a day past the browser's today so a check-in the server filed under
        // a later day (account zone ahead of the browser) is still in the result.
        const localKey = toLocalDateKey(new Date());
        const [year, month, day] = localKey.split('-').map(Number);
        const rangeStart = toLocalDateKey(new Date(year, month - 1, day - CALENDAR_WEEKS * 7));
        const rangeEnd = toLocalDateKey(new Date(year, month - 1, day + 1));

        Promise.all([
            request('GET', withTimeZone('/users-service/habits/user-habits?status=active')),
            request('GET', `/users-service/habits/checkins/range?startDate=${rangeStart}&endDate=${rangeEnd}`
                + `&habitGoalId=${encodeURIComponent(habitGoalId)}`),
            request('GET', '/users-service/habits/pacts/active'),
            views.serverToday ? Promise.resolve(null) : request('GET', withTimeZone('/users-service/habits/daily-streak/me')),
        ]).then(([habitsOut, checkinsOut, pactsOut, streakOut]) => {
            if (streakOut && streakOut.ok && /^\d{4}-\d{2}-\d{2}$/.test(streakOut.body.today || '')) {
                views.serverToday = streakOut.body.today;
            }
            const todayKey = currentDayKey();
            if (!habitsOut.ok) {
                renderError(errorMessage(habitsOut), () => renderHabit(habitGoalId));
                return;
            }
            const habit = ((habitsOut.body && habitsOut.body.userHabits) || [])
                .find((candidate) => candidate.habitGoalId === habitGoalId);
            if (!habit) {
                setView(h(
                    'div',
                    { class: 'app-state' },
                    h('p', { class: 'app-state__body' }, t('habit.notFound')),
                    link(APP_BASE, { class: 'btn btn--primary' }, t('nav.back')),
                ));
                return;
            }
            track('web_app_view', { view: 'habit' });
            views.paintHabit({
                habit,
                todayKey,
                checkins: checkinsOut.ok && Array.isArray(checkinsOut.body) ? checkinsOut.body : [],
                pacts: pactsOut.ok && Array.isArray(pactsOut.body) ? pactsOut.body : [],
            });
        }).catch(() => renderError(t('common.networkError'), () => renderHabit(habitGoalId)));
    };

    const noteForm = (todayCheckin) => {
        const textarea = h('textarea', {
            class: 'field', id: 'checkin-note', rows: '2', maxlength: '500', placeholder: t('habit.notePlaceholder'),
        });
        textarea.value = todayCheckin.notes || '';
        const save = h('button', { class: 'btn btn--secondary btn--small', type: 'submit' }, t('habit.noteSave'));
        return h(
            'form',
            {
                class: 'note-form',
                onsubmit: (event) => {
                    event.preventDefault();
                    save.disabled = true;
                    // Notes only. `savedAmount` is deliberately absent: the server reads its
                    // absence as "leave any recorded amount alone".
                    request('PUT', `/users-service/habits/checkins/${todayCheckin.id}`, { notes: textarea.value.trim() })
                        .then((out) => toast(out.ok ? t('habit.noteSaved') : errorMessage(out), out.ok ? undefined : 'error'))
                        .catch(() => toast(t('common.networkError'), 'error'))
                        .then(() => { save.disabled = false; });
                },
            },
            h('label', { class: 'field-label', for: 'checkin-note' }, t('habit.noteLabel')),
            textarea,
            save,
        );
    };

    views.paintHabit = (state) => {
        const { habit, todayKey } = state;
        const todayCheckin = state.checkins.find((checkin) => checkin.status === 'completed'
            && toDateKey(checkin.scheduledDate) === todayKey);
        const partners = getPartners(state.pacts, habit.habitGoalId, user.id);
        const pact = state.pacts.find((candidate) => candidate.habitGoalId === habit.habitGoalId);
        const calendar = buildCalendar(todayKey, state.checkins, CALENDAR_WEEKS);
        const initials = t('today.weekdayInitials').split(',');

        const checkinPanel = todayCheckin
            ? h(
                'section',
                { class: 'card card--done' },
                h('p', { class: 'done-line' }, icon(ICON_CHECK, 'done-line__icon'), t('habit.checkedIn')),
                noteForm(todayCheckin),
            )
            : h(
                'section',
                { class: 'card' },
                (() => {
                    const button = h('button', { class: 'btn btn--primary btn--block', type: 'button' }, t('habit.checkIn'));
                    button.addEventListener('click', () => {
                        button.disabled = true;
                        button.textContent = t('habit.checkingIn');
                        submitCheckin(habit).then((checkin) => {
                            if (!checkin) {
                                button.disabled = false;
                                button.textContent = t('habit.checkIn');
                                return;
                            }
                            // Refetch rather than guess the new streak; see habitCard.
                            renderHabit(habit.habitGoalId);
                        });
                    });
                    return button;
                })(),
            );

        setView(
            link(APP_BASE, { class: 'back-link' }, icon(ICON_BACK, 'back-link__icon'), t('nav.back')),
            h(
                'header',
                { class: 'detail-head' },
                h('span', { class: 'detail-head__emoji', 'aria-hidden': 'true' }, habit.goalEmoji || '✅'),
                h(
                    'div',
                    null,
                    h('h1', { class: 'app-title app-title--detail' }, habit.goalName),
                    h(
                        'p',
                        { class: 'detail-head__sub' },
                        describeCadence(dictionary, habit.frequencyType, habit.frequencyCount),
                        pact && pact.durationDays ? ` · ${t('habit.pactDays', { days: pact.durationDays })}` : '',
                    ),
                ),
            ),
            h(
                'dl',
                { class: 'stats' },
                h(
                    'div',
                    { class: 'stats__item' },
                    h('dt', null, t('habit.currentStreak')),
                    h('dd', null, String(Number(habit.currentStreak) || 0)),
                ),
                h(
                    'div',
                    { class: 'stats__item' },
                    h('dt', null, t('habit.longestStreak')),
                    h('dd', null, String(Math.max(Number(habit.longestStreak) || 0, Number(habit.currentStreak) || 0))),
                ),
            ),
            checkinPanel,
            h(
                'section',
                { class: 'section' },
                h('h2', { class: 'section__title' }, t('habit.partnersHeading')),
                partners.length ? h(
                    'ul',
                    { class: 'list' },
                    ...partners.map((partner) => h(
                        'li',
                        { class: 'member' },
                        h('span', { class: 'member__avatar', 'aria-hidden': 'true' }, (partner.name || '?').charAt(0).toUpperCase()),
                        h(
                            'span',
                            { class: 'member__text' },
                            h('span', { class: 'member__name' }, partner.name),
                            h('span', { class: 'member__meta' }, partner.isPending
                                ? t('habit.memberPending')
                                : [
                                    t('habit.memberStreak', { count: partner.currentStreak }),
                                    t('habit.memberRate', { percent: Math.round(partner.completionRate) }),
                                ].join(' · ')),
                        ),
                        partner.isPending ? null : h(
                            'span',
                            { class: `pill${partner.checkedInToday ? ' pill--done' : ''}` },
                            partner.checkedInToday ? t('habit.checkedIn') : '—',
                        ),
                    )),
                ) : h('p', { class: 'muted' }, habit.pendingPactId ? t('habit.awaitingPartner') : t('habit.solo')),
            ),
            h(
                'section',
                { class: 'section' },
                h('h2', { class: 'section__title' }, t('habit.calendarHeading')),
                h(
                    'div',
                    { class: 'calendar', role: 'img', 'aria-label': t('habit.calendarHeading') },
                    h('div', { class: 'calendar__row calendar__row--head' }, ...initials.map((initial) => h('span', null, initial))),
                    ...calendar.map((row) => h(
                        'div',
                        { class: 'calendar__row' },
                        ...row.map((cell) => h('span', {
                            class: `calendar__cell${cell.isDone ? ' is-done' : ''}${cell.isToday ? ' is-today' : ''}${cell.isFuture ? ' is-future' : ''}`,
                        }, String(cell.dayOfMonth))),
                    )),
                ),
            ),
            h('p', { class: 'muted app-note' }, t('habit.appOnlyNote')),
        );
    };

    // ---- discover ----

    const renderDiscover = () => {
        setActiveTab('discover');
        renderLoading();

        Promise.all([
            request('GET', '/users-service/habits/pacts/open'),
            request('GET', `/users-service/habits/goals/templates?limit=${TEMPLATE_LIMIT}`),
            request('GET', withTimeZone('/users-service/habits/user-habits?status=active')),
        ]).then(([openOut, templatesOut, habitsOut]) => {
            if (!openOut.ok && !templatesOut.ok) {
                renderError(errorMessage(openOut), renderDiscover);
                return;
            }
            track('web_app_view', { view: 'discover' });
            views.paintDiscover({
                openPacts: (openOut.ok && openOut.body.pacts) || [],
                maxMembers: (openOut.ok && openOut.body.maxMembers) || 0,
                templates: templatesOut.ok && Array.isArray(templatesOut.body) ? templatesOut.body : [],
                trackedGoalIds: ((habitsOut.ok && habitsOut.body.userHabits) || []).map((habit) => habit.habitGoalId),
            });
        }).catch(() => renderError(t('common.networkError'), renderDiscover));
    };

    const openPactCard = (pact, state) => {
        const action = h('div', { class: 'open-pact__action' });
        const paintAction = (hasRequest) => {
            action.textContent = '';
            const button = h('button', {
                class: `btn btn--small ${hasRequest ? 'btn--quiet' : 'btn--primary'}`,
                type: 'button',
                onclick: () => {
                    button.disabled = true;
                    const call = hasRequest
                        ? request('DELETE', `/users-service/habits/pacts/${pact.id}/join-requests/mine`)
                        : request('POST', `/users-service/habits/pacts/${pact.id}/join-requests`);
                    call.then((out) => {
                        if (!out.ok) {
                            // 402 is the free tier's habit cap; the server's message says so.
                            toast(errorMessage(out), 'error');
                            button.disabled = false;
                            return;
                        }
                        track(hasRequest ? 'open_pact_request_cancel' : 'open_pact_request');
                        toast(t(hasRequest ? 'discover.requestCancelledToast' : 'discover.requestSentToast'));
                        paintAction(!hasRequest);
                    }).catch(() => {
                        toast(t('common.networkError'), 'error');
                        button.disabled = false;
                    });
                },
            }, hasRequest ? t('discover.cancelRequest') : t('discover.askToJoin'));
            if (hasRequest) {
                action.appendChild(h('span', { class: 'pill pill--done' }, t('discover.requested')));
            }
            action.appendChild(button);
        };
        paintAction(!!pact.hasPendingJoinRequest);

        return h(
            'li',
            { class: 'open-pact' },
            h('span', { class: 'habit__emoji', 'aria-hidden': 'true' }, pact.habitGoalEmoji || '🤝'),
            h(
                'div',
                { class: 'open-pact__text' },
                h('p', { class: 'habit__name' }, pact.habitGoalName),
                h('p', { class: 'habit__partner' }, t('discover.startedBy', { userName: pact.creatorUserName || '' })),
                h(
                    'p',
                    { class: 'habit__meta' },
                    h('span', { class: 'pill' }, describeCadence(dictionary, pact.habitGoalFrequencyType, pact.habitGoalFrequencyCount)),
                    pact.durationDays ? h('span', { class: 'pill' }, t('discover.days', { days: pact.durationDays })) : null,
                    state.maxMembers ? h('span', { class: 'pill' }, t('discover.spots', {
                        count: Number(pact.memberCount) || 0, max: state.maxMembers,
                    })) : null,
                ),
                action,
            ),
        );
    };

    const templateCard = (template, state) => {
        const isTracked = state.trackedGoalIds.indexOf(template.id) !== -1;
        const button = h('button', {
            class: 'btn btn--secondary btn--small',
            type: 'button',
            disabled: isTracked,
            onclick: () => {
                button.disabled = true;
                request('POST', '/users-service/habits/user-habits', { habitGoalId: template.id }).then((out) => {
                    if (!out.ok) {
                        // 403 solo-locked and 402 habit-limit both carry a localized message
                        // that explains what to do next; show it as it is.
                        toast(errorMessage(out), 'error');
                        button.disabled = false;
                        return;
                    }
                    track('habit_start', { source: 'template' });
                    toast(t('discover.startedToast', { habit: template.name }));
                    navigate(APP_BASE);
                }).catch(() => {
                    toast(t('common.networkError'), 'error');
                    button.disabled = false;
                });
            },
        }, isTracked ? t('discover.alreadyTracking') : t('discover.start'));

        return h(
            'li',
            { class: 'template' },
            h('span', { class: 'habit__emoji', 'aria-hidden': 'true' }, template.emoji || '✅'),
            h('span', { class: 'template__name' }, template.name),
            button,
        );
    };

    views.paintDiscover = (state) => {
        setView(
            h('h1', { class: 'app-title' }, t('discover.heading')),
            h('p', { class: 'muted' }, t('discover.intro')),
            state.openPacts.length
                ? h('ul', { class: 'list' }, ...state.openPacts.map((pact) => openPactCard(pact, state)))
                : h('p', { class: 'card card--tint muted' }, t('discover.empty')),
            state.templates.length ? h(
                'section',
                { class: 'section' },
                h('h2', { class: 'section__title' }, t('discover.templatesHeading')),
                h('p', { class: 'muted' }, t('discover.templatesIntro')),
                h('ul', { class: 'list list--tight' }, ...state.templates.map((template) => templateCard(template, state))),
            ) : null,
        );
    };

    // ---- start ----

    views.renderRoute = () => {
        const route = parseRoute(root.location.pathname);
        if (route.name === 'habit') {
            renderHabit(route.habitGoalId);
        } else if (route.name === 'discover') {
            renderDiscover();
        } else {
            renderToday();
        }
    };

    const start = () => {
        if (!user) {
            goToLogin();
            return;
        }
        Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'), (tab) => {
            tab.addEventListener('click', (event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button) {
                    return;
                }
                event.preventDefault();
                navigate(tab.getAttribute('href'));
            });
        });
        root.addEventListener('popstate', views.renderRoute);
        views.renderRoute();
    };

    start();
}(typeof window !== 'undefined' ? window : {}));
