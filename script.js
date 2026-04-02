const API_KEY = '0010a32a4e1e60188f2036b82b0a8a1b';
const IMG_PATH = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_PATH = 'https://image.tmdb.org/t/p/w1280';

let myData = JSON.parse(localStorage.getItem('watchopedia_v9')) || { watchlist: [], inprogress: [], watched: [] };
let tempSelection = null;
let currentRating = 0;

// Filter States (Added Search and Category)
let activeFilters = { 
    watchlist: { search: '', category: 'All', genre: 'All', lang: 'All' }, 
    inprogress: { search: '', category: 'All', genre: 'All', lang: 'All' }, 
    watched: { search: '', category: 'All', genre: 'All', lang: 'All' } 
};

// Utility: Convert language code to full language name
function getLangName(code) {
    if (!code || code === 'N/A') return 'Unknown';
    if (code.length > 2 && code !== 'N/A') return code;
    try {
        const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
        return displayNames.of(code.toLowerCase());
    } catch (e) {
        return code.toUpperCase();
    }
}

// Utility: Smart Category Derivation
function deriveCategory(type, details) {
    let cat = type === 'tv' ? 'Series' : 'Movie';
    if (details && details.genres) {
        const genreNames = details.genres.map(g => g.name);
        if (genreNames.includes('Documentary')) {
            cat = 'Documentary';
        } else if (genreNames.includes('Animation')) {
            if (details.origin_country && details.origin_country.includes('JP')) {
                cat = 'Anime';
            } else {
                cat = 'Animation';
            }
        }
    }
    return cat;
}

function showPage(pageId) {
    document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
    document.getElementById(pageId).style.display = 'block';
    if(pageId === 'homePage') renderHome();
    if(pageId === 'explorePage') loadExploreCategory();
}

function closeEditForm() {
    document.getElementById('editForm').style.display = 'none';
    document.getElementById('adminSearch').value = '';
    tempSelection = null;
    showPage('homePage'); // Returns to home if user cancels
}

// --- HOME PAGE LOGIC (Filters, Search, Scrolling & Expanding) ---
function scrollSection(id, amount) {
    document.getElementById(id).scrollBy({ left: amount, behavior: 'smooth' });
}

function toggleExpand(id, btn) {
    const el = document.getElementById(id);
    const wrapper = el.parentElement;
    if (el.classList.contains('expanded-grid')) {
        el.classList.remove('expanded-grid');
        wrapper.classList.remove('expanded');
        btn.innerText = 'Expand';
    } else {
        el.classList.add('expanded-grid');
        wrapper.classList.add('expanded');
        btn.innerText = 'Collapse';
    }
}

function updateFilter(section, type, value) {
    activeFilters[section][type] = value;
    renderHome();
}

function buildFilters(list, sectionId) {
    const container = document.getElementById(`filters-${sectionId}`);
    if (!container) return;

    let categories = new Set();
    let genres = new Set();
    let langs = new Set();

    list.forEach(item => {
        if (item.language && item.language.length === 2) item.language = getLangName(item.language);
        if (!item.language) item.language = 'Unknown';
        if (!item.mediaCategory) item.mediaCategory = item.type === 'tv' ? 'Series' : 'Movie';

        categories.add(item.mediaCategory);
        if (item.genres && item.genres !== 'N/A') item.genres.split(', ').forEach(g => genres.add(g));
        langs.add(item.language);
    });

    const createSelect = (type, options, currentValue) => {
        let label = type === 'category' ? 'Categories' : type === 'genre' ? 'Genres' : 'Languages';
        return `<select onchange="updateFilter('${sectionId}', '${type}', this.value)">
            <option value="All">All ${label}</option>
            ${Array.from(options).sort().map(opt => `<option value="${opt}" ${currentValue === opt ? 'selected' : ''}>${opt}</option>`).join('')}
        </select>`;
    };

    const createSearch = (currentValue) => {
        return `<input type="text" class="section-search" placeholder="Search..." value="${currentValue}" oninput="updateFilter('${sectionId}', 'search', this.value)">`;
    };

    container.innerHTML = createSearch(activeFilters[sectionId].search) +
                          createSelect('category', categories, activeFilters[sectionId].category) + 
                          createSelect('genre', genres, activeFilters[sectionId].genre) + 
                          createSelect('lang', langs, activeFilters[sectionId].lang);
}

function renderHome() {
    const draw = (rawList, id, sectionKey) => {
        buildFilters(rawList, sectionKey);

        const fCat = activeFilters[sectionKey].category;
        const fGenre = activeFilters[sectionKey].genre;
        const fLang = activeFilters[sectionKey].lang;
        const fSearch = activeFilters[sectionKey].search.toLowerCase();
        
        let list = rawList.filter(item => {
            let passSearch = fSearch === '' || (item.title && item.title.toLowerCase().includes(fSearch));
            let passCat = fCat === 'All' || item.mediaCategory === fCat;
            let passGenre = fGenre === 'All' || (item.genres && item.genres.includes(fGenre));
            let passLang = fLang === 'All' || item.language === fLang;
            return passSearch && passCat && passGenre && passLang;
        });

        const el = document.getElementById(id);
        el.innerHTML = list.length ? '' : '<p style="color:#333; font-style:italic;">No matches.</p>';
        
        list.forEach(item => {
            if (!item.poster || item.poster === 'undefined') return; // Safety block for broken old data

            const card = document.createElement('div');
            card.className = 'card';
            card.oncontextmenu = (e) => showContextMenu(e, item);
            
            const progressText = (item.status === 'inprogress' && item.season) 
                ? `<div class="card-progress">S${item.season} E${item.episode || '?'}</div>` : '';

            card.innerHTML = `
                <img src="${IMG_PATH + item.poster}" onclick='openHomeDetail(${JSON.stringify(item).replace(/'/g, "&apos;")})'>
                ${progressText}
            `;
            el.appendChild(card);
        });
    };

    draw(myData.watchlist, 'homeWatchlist', 'watchlist');
    draw(myData.inprogress, 'homeInProgress', 'inprogress');
    draw(myData.watched, 'homeWatched', 'watched');

    localStorage.setItem('watchopedia_v9', JSON.stringify(myData));
}

// --- CONTEXT MENU (With Smart Form Modals) ---
const contextMenu = document.getElementById('contextMenu');
let rightClickedItem = null;

function showContextMenu(e, item) {
    e.preventDefault();
    rightClickedItem = item;
    
    document.getElementById('menuMoveWatchlist').style.display = item.status === 'watchlist' ? 'none' : 'block';
    document.getElementById('menuMoveInProgress').style.display = item.status === 'inprogress' ? 'none' : 'block';
    document.getElementById('menuMoveWatched').style.display = item.status === 'watched' ? 'none' : 'block';

    let x = e.pageX; let y = e.pageY;
    if (x + 200 > window.innerWidth) x = window.innerWidth - 220;
    contextMenu.style.top = `${y}px`; contextMenu.style.left = `${x}px`; contextMenu.style.display = 'block';
}

document.addEventListener('click', () => { if (contextMenu.style.display === 'block') contextMenu.style.display = 'none'; });

async function contextChangeStatus(newStatus) {
    if (!rightClickedItem) return;
    const isTv = rightClickedItem.type === 'tv';

    if ((newStatus === 'inprogress' && isTv) || newStatus === 'watched') {
        showPage('addPage');
        await selectForEdit(rightClickedItem);
        document.getElementById('formStatus').value = newStatus;
        toggleFormFields();
    } else {
        const old = rightClickedItem.status;
        const idx = myData[old].findIndex(i => i.id === rightClickedItem.id);
        const item = myData[old].splice(idx, 1)[0];
        item.status = newStatus;
        myData[newStatus].push(item);
        localStorage.setItem('watchopedia_v9', JSON.stringify(myData));
        renderHome();
    }
}

function contextRemoveItem() {
    if (rightClickedItem) {
        ['watchlist', 'inprogress', 'watched'].forEach(key => { myData[key] = myData[key].filter(i => i.id !== rightClickedItem.id); });
        localStorage.setItem('watchopedia_v9', JSON.stringify(myData));
        renderHome();
    }
}

// --- RECORD DETAIL MODAL ---
function openHomeDetail(item) {
    document.getElementById('modalHero').style.backgroundImage = `url(${BACKDROP_PATH + item.backdrop})`;
    document.getElementById('hTitle').innerText = item.title;
    document.getElementById('hMeta').innerText = `${item.mediaCategory || 'Media'} • ${item.genres} • ${item.language || 'N/A'}`;
    document.getElementById('hPlot').innerText = item.overview;
    document.getElementById('hCast').innerText = item.cast;

    const journal = document.getElementById('hJournal');
    let progressLine = '';
    if (item.status === 'inprogress') progressLine = `<p class="accent-text" style="color:var(--white); font-weight:bold;">Currently Watching: Season ${item.season || '?'} • Episode ${item.episode || '?'}</p>`;
    
    journal.innerHTML = item.status === 'watched' ? 
        `<h3>Journal Entry</h3><p>Rating: <span style="color:#fff">${'★'.repeat(item.rating) || 'Unrated'}</span></p><p style="color:#ccc">"${item.review || 'No notes left.'}"</p>` : 
        `${progressLine}<p class="accent-text">Status: ${item.status === 'inprogress' ? 'In Progress' : 'Yet to Watch'}</p>`;

    document.getElementById('homeDetailModal').style.display = 'block';
}

function closeHomeDetail() { document.getElementById('homeDetailModal').style.display = 'none'; }

// --- ADD / CURATE LOGIC ---
const adminSearch = document.getElementById('adminSearch');
const adminSearchResults = document.getElementById('adminSearchResults');

adminSearch.addEventListener('input', async (e) => {
    const query = e.target.value;
    if (query.length < 3) { adminSearchResults.style.display = 'none'; return; }
    const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${query}`);
    const data = await res.json();
    adminSearchResults.innerHTML = '';
    
    if (data.results.length > 0) {
        adminSearchResults.style.display = 'block';
        data.results.slice(0, 5).forEach(item => {
            const div = document.createElement('div');
            div.className = 'search-item';
            div.innerText = `${item.title || item.name} (${(item.release_date || item.first_air_date || 'N/A').split('-')[0]})`;
            div.onclick = () => selectForEdit(item);
            adminSearchResults.appendChild(div);
        });
    } else { adminSearchResults.style.display = 'none'; }
});

async function selectForEdit(item) {
    const type = item.media_type || item.type || (item.title ? 'movie' : 'tv');
    let details = {};
    
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${item.id}?api_key=${API_KEY}&append_to_response=credits`);
        details = await res.json();
    } catch(err) {}

    // THE FIX: This safely grabs the poster and backdrop whether it came from the API search or your local database
    tempSelection = {
        id: item.id, 
        title: item.title || item.name, 
        poster: item.poster_path || item.poster || details.poster_path, 
        backdrop: item.backdrop_path || item.backdrop || details.backdrop_path,
        type: type, 
        overview: details.overview || item.overview, 
        cast: details.credits && details.credits.cast ? details.credits.cast.slice(0,5).map(c=>c.name).join(', ') : (item.cast || 'N/A'),
        genres: details.genres ? details.genres.map(g=>g.name).join(', ') : (item.genres || 'N/A'),
        language: getLangName(details.original_language || item.language),
        mediaCategory: deriveCategory(type, details) || item.mediaCategory
    };

    document.getElementById('editForm').style.display = 'block';
    document.getElementById('editTitle').innerText = tempSelection.title;
    document.getElementById('editPoster').src = IMG_PATH + tempSelection.poster;
    adminSearchResults.style.display = 'none'; adminSearch.value = '';

    const existing = [...myData.watchlist, ...myData.inprogress, ...myData.watched].find(i => i.id === item.id);
    if(existing) {
        document.getElementById('formStatus').value = existing.status;
        document.getElementById('formReview').value = existing.review || '';
        currentRating = existing.rating || 0;
    } else {
        document.getElementById('formStatus').value = 'watchlist';
        document.getElementById('formReview').value = '';
        currentRating = 0;
    }
    updateStarsUI();

    const sSelect = document.getElementById('formSeason');
    const eSelect = document.getElementById('formEp');
    sSelect.innerHTML = '<option value="">Select Season</option>'; eSelect.innerHTML = '<option value="">Select Episode</option>';

    if (type === 'tv' && details.seasons) {
        details.seasons.forEach(s => {
            if(s.season_number > 0) {
                const opt = document.createElement('option');
                opt.value = s.season_number; opt.innerText = `Season ${s.season_number}`;
                sSelect.appendChild(opt);
            }
        });
        if(existing && existing.season) {
            sSelect.value = existing.season;
            await updateEpisodes();
            if(existing.episode) eSelect.value = existing.episode;
        }
    }
    toggleFormFields();
}

async function updateEpisodes() {
    const sNum = document.getElementById('formSeason').value;
    const eSelect = document.getElementById('formEp');
    if (!sNum) { eSelect.innerHTML = '<option value="">Select Episode</option>'; return; }
    eSelect.innerHTML = '<option value="">Loading...</option>';
    try {
        const res = await fetch(`https://api.themoviedb.org/3/tv/${tempSelection.id}/season/${sNum}?api_key=${API_KEY}`);
        const sDetails = await res.json();
        eSelect.innerHTML = '<option value="">Select Episode</option>';
        if(sDetails.episodes) {
            sDetails.episodes.forEach(ep => {
                const opt = document.createElement('option');
                opt.value = ep.episode_number; opt.innerText = `Ep ${ep.episode_number}: ${ep.name}`;
                eSelect.appendChild(opt);
            });
        }
    } catch(err) { eSelect.innerHTML = '<option value="">Error loading</option>'; }
}

function toggleFormFields() {
    const status = document.getElementById('formStatus').value;
    const isTv = tempSelection && tempSelection.type === 'tv';
    
    document.getElementById('watchedFields').style.display = (status === 'watched' || status === 'inprogress') ? 'block' : 'none';
    document.getElementById('tvFields').style.display = (isTv && status === 'inprogress') ? 'flex' : 'none';
    
    const displayDetails = status === 'watched' ? 'flex' : 'none';
    document.getElementById('ratingGroup').style.display = displayDetails;
    document.getElementById('reviewGroup').style.display = displayDetails;
}

function updateStarsUI() { document.querySelectorAll('.star').forEach(s => s.classList.toggle('active', s.dataset.value <= currentRating)); }
document.querySelectorAll('.star').forEach(star => { star.onclick = (e) => { currentRating = parseInt(e.target.dataset.value); updateStarsUI(); }; });

function commitToLibrary() {
    if (!tempSelection) return;
    const entry = { ...tempSelection, status: document.getElementById('formStatus').value, rating: currentRating, review: document.getElementById('formReview').value, season: document.getElementById('formSeason').value, episode: document.getElementById('formEp').value };
    ['watchlist', 'inprogress', 'watched'].forEach(key => { myData[key] = myData[key].filter(i => i.id !== entry.id); });
    myData[entry.status].push(entry);
    localStorage.setItem('watchopedia_v9', JSON.stringify(myData));
    closeEditForm();
}

// --- BULK IMPORT LOGIC ---
async function runBulkImport() {
    const text = document.getElementById('bulkImportText').value;
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const statusText = document.getElementById('bulkStatus');
    const btn = document.getElementById('bulkBtn');
    if (lines.length === 0) return;

    btn.disabled = true; statusText.style.display = 'block';
    let successCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const title = lines[i];
        statusText.innerText = `Importing (${i + 1}/${lines.length}): ${title}...`;
        try {
            const searchRes = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${title}`);
            const searchData = await searchRes.json();
            if (searchData.results && searchData.results.length > 0) {
                const item = searchData.results[0];
                const type = item.media_type || (item.title ? 'movie' : 'tv');
                const existing = [...myData.watchlist, ...myData.inprogress, ...myData.watched].find(x => x.id === item.id);
                if (existing) continue;

                const detailRes = await fetch(`https://api.themoviedb.org/3/${type}/${item.id}?api_key=${API_KEY}&append_to_response=credits`);
                const details = await detailRes.json();
                
                myData.watchlist.push({
                    id: item.id, title: item.title || item.name, poster: item.poster_path || details.poster_path, backdrop: item.backdrop_path || details.backdrop_path,
                    type: type, overview: item.overview, cast: details.credits && details.credits.cast ? details.credits.cast.slice(0,5).map(c=>c.name).join(', ') : 'N/A',
                    genres: details.genres ? details.genres.map(g=>g.name).join(', ') : 'N/A', 
                    language: getLangName(details.original_language),
                    mediaCategory: deriveCategory(type, details),
                    status: 'watchlist', rating: 0, review: '', season: '', episode: ''
                });
                successCount++;
            }
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) { console.error(`Failed to import ${title}`, error); }
    }
    localStorage.setItem('watchopedia_v9', JSON.stringify(myData));
    document.getElementById('bulkImportText').value = '';
    statusText.innerText = `Done! Imported ${successCount} titles.`;
    btn.disabled = false; renderHome();
}

// --- ENHANCED EXPLORE PAGE ---
async function loadExploreCategory() {
    const type = document.getElementById('exploreCategory').value;
    let url = '';
    if(type === 'trending') url = `https://api.themoviedb.org/3/trending/all/day?api_key=${API_KEY}`;
    if(type === 'popular_movie') url = `https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}`;
    if(type === 'popular_tv') url = `https://api.themoviedb.org/3/tv/popular?api_key=${API_KEY}`;
    if(type === 'top_rated') url = `https://api.themoviedb.org/3/movie/top_rated?api_key=${API_KEY}`;
    
    document.getElementById('exploreSearch').value = ''; 
    fetchAndRenderExplore(url);
}

async function handleExploreSearch(e) {
    const query = e.target.value;
    if(query.length < 3) { if(query.length === 0) loadExploreCategory(); return; }
    fetchAndRenderExplore(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${query}`);
}

async function fetchAndRenderExplore(url) {
    const res = await fetch(url);
    const data = await res.json();
    const grid = document.getElementById('exploreGrid');
    grid.innerHTML = '';
    data.results.forEach(item => {
        if(!item.poster_path) return; 
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<img src="${IMG_PATH + item.poster_path}">`;
        card.onclick = () => showExploreDetail(item);
        grid.appendChild(card);
    });
}

async function showExploreDetail(item) {
    const type = item.media_type || (item.title ? 'movie' : 'tv');
    const res = await fetch(`https://api.themoviedb.org/3/${type}/${item.id}?api_key=${API_KEY}&append_to_response=credits`);
    const data = await res.json();
    const itemData = JSON.stringify(item).replace(/'/g, "&apos;");

    document.getElementById('detailContent').innerHTML = `
        <h2 style="font-size:2rem; margin-bottom:10px;">${data.title || data.name}</h2>
        <p class="accent-text" style="margin-bottom:20px;">${deriveCategory(type, data)} • ${data.genres ? data.genres.map(g=>g.name).join(' • ') : ''}</p>
        <div style="height: calc(100% - 150px);"><p style="font-size:0.9rem; line-height:1.8;">${data.overview}</p></div>
        <button class="save-btn" style="width:100%; margin-top:20px;" onclick='showPage("addPage"); selectForEdit(${itemData})'>Import to Curator</button>
    `;
}

// Start App
showPage('homePage');
