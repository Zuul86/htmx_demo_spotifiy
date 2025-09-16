const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
require('dotenv').config();
 
const app = express();
const port = 8888;
 
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
 
// Store access token in a simple in-memory variable for this example
let accessToken = '';
 
// Helper function to generate a random string
const generateRandomString = (length) => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};
 
// Main HTML page with HTMX
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Spotify Playlists</title>
      <script src="https://unpkg.com/htmx.org@1.9.4"></script>
      <style>
        body { font-family: sans-serif; margin: 2em; }
        .container { display: flex; gap: 2em; }
        .playlists { flex: 1; border: 1px solid #ccc; padding: 1em; }
        .tracks { flex: 2; border: 1px solid #ccc; padding: 1em; }
        ul { list-style: none; padding: 0; }
        li { padding: 0.5em; cursor: pointer; border-bottom: 1px solid #eee; }
        li:hover { background-color: #f0f0f0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 0.5em; border-bottom: 1px solid #ddd; }
        th { background-color: #f4f4f4; }
      </style>
    </head>
    <body>
      <h1>My Spotify Playlists</h1>
      <a href="/login">Login with Spotify</a>
      <div class="container">
        <div id="playlists-container" class="playlists">
          <button hx-get="/playlists" hx-trigger="click" hx-target="#playlists-list">Load Playlists</button>
          <ul id="playlists-list"></ul>
        </div>
        <div id="tracks-container" class="tracks">
          <h2>Select a Playlist</h2>
          <div id="tracks-list"></div>
        </div>
      </div>
    </body>
    </html>
  `);
});
 
// Route to start the Spotify authorization process
app.get('/login', (req, res) => {
  const state = generateRandomString(16);
  const scope = 'playlist-read-private playlist-read-collaborative';
 
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: scope,
      redirect_uri: REDIRECT_URI,
      state: state
    }));
});
 
// Route to handle the callback and get the access token
app.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;
 
  if (state === null) {
    return res.send('state_mismatch');
  }
 
  try {
    const tokenResponse = await axios.post('https://accounts.spotify.com/api/token',
      querystring.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
      }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')
      }
    });
 
    accessToken = tokenResponse.data.access_token;
    res.redirect('/');
  } catch (error) {
    console.error('Error getting access token:', error.response ? error.response.data : error.message);
    res.send('Failed to get access token.');
  }
});
 
// HTMX endpoint to fetch and render the list of playlists
app.get('/playlists', async (req, res) => {
  if (!accessToken) {
    return res.send('Please <a href="/login">login with Spotify</a> first.');
  }
 
  try {
    const playlistsResponse = await axios.get('https://api.spotify.com/v1/me/playlists', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
 
    const playlists = playlistsResponse.data.items;
    let html = '';
    playlists.forEach(playlist => {
      // HTMX attributes on the list item to fetch tracks on click
      html += `<li hx-get="/tracks/${playlist.id}" hx-target="#tracks-list">${playlist.name}</li>`;
    });
    res.send(html);
  } catch (error) {
    console.error('Error fetching playlists:', error.response ? error.response.data : error.message);
    res.status(500).send('Failed to fetch playlists.');
  }
});
 
// HTMX endpoint to fetch and render the tracks for a given playlist
app.get('/tracks/:playlistId', async (req, res) => {
  if (!accessToken) {
    return res.status(401).send('Unauthorized. Please <a href="/login">log in</a>.');
  }

  const playlistId = req.params.playlistId;
 
  try {
    const tracksResponse = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
 
    const tracks = tracksResponse.data.items;
    let html = '<table><thead><tr><th>Song Title</th><th>Artist</th><th>Album</th><th>Date Released</th></tr></thead><tbody>';
    tracks.forEach(item => {
      const track = item.track;
      const artists = track.artists.map(artist => artist.name).join(', ');
      html += `<tr><td>${track.name}</td><td>${artists}</td><td>${track.album.name}</td><td>${track.album.release_date}</td></tr>`;
    });
    html += '</tbody></table>';
 
    res.send(html);
  } catch (error) {
    console.error('Error fetching tracks:', error.response ? error.response.data : error.message);
    res.status(500).send('Failed to fetch tracks.');
  }
});
 
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});