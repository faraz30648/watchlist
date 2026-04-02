const API_KEY = '0010a32a4e1e60188f2036b82b0a8a1b';
const IMG_PATH = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_PATH = 'https://image.tmdb.org/t/p/w1280';

let myData = JSON.parse(localStorage.getItem('watchopedia_v5')) || { watchlist: [], watched: [] };
let tempSelection = null;

// --- NAVIGATION ---
function showPage(pageId) {
    document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
    document.getElementById(pageId).style.display = 'block';
    if(pageId === 'homePage') renderHome();
    if(pageId === 'explorePage') getExplore();
}

// --- HOME PAGE (READER VIEW) ---
function renderHome() {
    const draw = (list, id) => {
        const el = document.getElementById(id);
        el.innerHTML = list.length ? '' : '<p style="color:#444">Empty.</p>';
        list.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `<img src="${IMG_PATH + item.poster}">`;
            card.onclick = () => openHomeDetail(item);
            el.appendChild(card);
        });
    };
    draw(myData.watchlist, 'homeWatchlist');
    draw(myData.watched, 'homeWatched');
}

function openHomeDetail(item) {
    document.getElementById('modalHero').style.backgroundImage = `url(${BACKDROP_PATH + item.backdrop})`;
    document.getElementById('hTitle').innerText = item.title;
    document.getElementById('hMeta').innerText = `${item.genres} • ${item.type.toUpperCase()}`;
    document.getElementById('hPlot').innerText = item.overview;
    document.getElementById('hCast').innerText = item.cast;

    const journal = document.getElementById('hJournal');
    journal.innerHTML = item.status === 'watched' ? 
        `<h3>Archive Entry</h3><p>Rating: ★ ${item.rating}/10</p><p>${item.review}</p>` : 
        `<p class="accent-text">Pending Viewing.</p>`;

    document.getElementById('homeDetailModal').style.display = 'block';
}

function closeHomeDetail() { document.getElementById('homeDetailModal').style.display = 'none'; }

// --- ADD NEW PAGE ---
const adminSearch = document.getElementById('adminSearch');
adminSearch.addEventListener('input', async (e) => {
    if (e.target.value.length < 3) return;
    const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${e.target.value}`);
    const data = await res.json();
    const resultsDiv = document.getElementById('adminSearchResults');
    resultsDiv.innerHTML = '';
    data.results.slice(0, 5).forEach(item => {
        const div = document.createElement('div');
        div.className = 'search-item';
        div.innerText = item.title || item.name;
        div.onclick = () => selectForEdit(item);
        resultsDiv.appendChild(div);
    });
});

async function selectForEdit(item) {
    const type = item.media_type || (item.title ? 'movie' : 'tv');
    const res = await fetch(`https://api.themoviedb.org/3/${type}/${item.id}?api_key=${API_KEY}&append_to_response=credits`);
    const details = await res.json();

    tempSelection = {
        id: item.id, title: item.title || item.name, poster: item.poster_path, backdrop: item.backdrop_path,
        type: type, overview: item.overview, cast: details.credits.cast.slice(0,5).map(c=>c.name).join(', '),
        genres: details.genres.map(g=>g.name).join(', ')
    };

    document.getElementById('editForm').style.display = 'block';
    document.getElementById('editTitle').innerText = tempSelection.title;
    document.getElementById('editPoster').src = IMG_PATH + tempSelection.poster;
    document.getElementById('adminSearchResults').innerHTML = '';
    toggleFormFields();
}

function toggleFormFields() {
    const status = document.getElementById('formStatus').value;
    document.getElementById('watchedFields').style.display = status === 'watched' ? 'block' : 'none';
    document.getElementById('tvFields').style.display = (status === 'watched' && tempSelection.type === 'tv') ? 'block' : 'none';
}

function commitToLibrary() {
    const entry = {
        ...tempSelection,
        status: document.getElementById('formStatus').value,
        rating: document.getElementById('formRating').value,
        review: document.getElementById('formReview').value,
        season: document.getElementById('formSeason').value,
        episode: document.getElementById('formEp').value
    };
    myData.watchlist = myData.watchlist.filter(i => i.id !== entry.id);
    myData.watched = myData.watched.filter(i => i.id !== entry.id);
    myData[entry.status].push(entry);
    localStorage.setItem('watchopedia_v5', JSON.stringify(myData));
    alert("Updated.");
    showPage('homePage');
}

// --- EXPLORE PAGE ---
async function getExplore() {
    const res = await fetch(`https://api.themoviedb.org/3/trending/all/day?api_key=${API_KEY}`);
    const data = await res.json();
    const grid = document.getElementById('exploreGrid');
    grid.innerHTML = '';
    data.results.forEach(item => {
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
    document.getElementById('detailContent').innerHTML = `
        <h2 style="font-size:1.8rem">${data.title || data.name}</h2>
        <p class="accent-text">${data.genres.map(g=>g.name).join(' • ')}</p>
        <p style="font-size:0.85rem">${data.overview}</p>
        <button class="save-btn" style="width:100%" onclick='showPage("addPage"); selectForEdit(${JSON.stringify(item)})'>Import to Curator</button>
    `;
showPage('homePage');
