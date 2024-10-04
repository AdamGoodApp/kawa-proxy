import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import { parse, stringify, types } from 'hls-parser';

const app = express();
const PORT = process.env.PORT || 3008;

app.use(cors());

const ORIGINAL_DOMAIN = 'romeo.ilovephones.site';
const ORIGINAL_REFERER = 'https://www.braflix.gd/';
const ORIGINAL_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

function isValidUrl(targetUrl: string) {
  try {
    const parsedUrl = new URL(targetUrl);
    return parsedUrl.hostname === ORIGINAL_DOMAIN;
  } catch (e) {
    return false;
  }
}

app.get('/', async (req, res) => {
  const m3u8Url = String(req.query.url);

  if (!m3u8Url) {
    res.status(400).send('Missing url parameter');
    return;
  }

  if (!isValidUrl(m3u8Url)) {
    res.status(403).send('Forbidden');
    return;
  }

  try {
    // Fetch the original m3u8 playlist with necessary headers
    const response = await fetch(m3u8Url, {
      headers: {
        'sec-ch-ua-platform': '"macOS"',
        Referer: ORIGINAL_REFERER,
        'User-Agent': ORIGINAL_USER_AGENT,
        'sec-ch-ua':
          '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
        DNT: '1',
        'sec-ch-ua-mobile': '?0',
      },
    });

    if (!response.ok) {
      res
        .status(response.status)
        .send(`Failed to fetch m3u8 file: ${response.statusText}`);
      return;
    }

    const playlistText = await response.text();

    // Parse the m3u8 playlist
    const playlist = parse(playlistText);

    // Modify the playlist to route .ts segments through the proxy
    if ('segments' in playlist && playlist.segments.length > 0) {
      playlist.segments.forEach((segment) => {
        // Resolve the absolute URL for each segment
        const segmentUrl = new URL(segment.uri, m3u8Url).toString();
        // Update the segment URI to point to the proxy route
        segment.uri = `/proxy-ts?url=${encodeURIComponent(segmentUrl)}`;
      });
    }

    // Define a type guard to check if playlist has keys
    function hasKeys(playlist: any): playlist is { keys: any[] } {
      return 'keys' in playlist;
    }

    if (hasKeys(playlist) && playlist.keys.length > 0) {
      playlist.keys.forEach((key) => {
        if (key.uri) {
          const keyUrl = new URL(key.uri, m3u8Url).toString();
          key.uri = `/proxy-key?url=${encodeURIComponent(keyUrl)}`;
        }
      });
    }

    // Serialize the modified playlist back to m3u8 format
    const modifiedPlaylist = stringify(playlist);

    // Set appropriate headers for the client
    res.set({
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-cache',
    });

    res.send(modifiedPlaylist);
  } catch (error) {
    console.error('Error fetching m3u8 file:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to proxy the .ts segments
app.get('/proxy-ts', async (req, res) => {
  const tsUrl = req.query.url;

  if (typeof tsUrl === 'string' && isValidUrl(tsUrl)) {
    // Proceed with valid URL
  } else {
    res.status(403).send('Forbidden');
    return;
  }

  if (!tsUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }

  if (!isValidUrl(tsUrl)) {
    res.status(403).send('Forbidden');
    return;
  }

  try {
    const response = await fetch(tsUrl, {
      headers: {
        'sec-ch-ua-platform': '"macOS"',
        Referer: ORIGINAL_REFERER,
        'User-Agent': ORIGINAL_USER_AGENT,
        'sec-ch-ua':
          '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
        DNT: '1',
        'sec-ch-ua-mobile': '?0',
      },
    });

    if (!response.ok) {
      res
        .status(response.status)
        .send(`Failed to fetch .ts segment: ${response.statusText}`);
      return;
    }

    // Set appropriate headers for the client
    res.set({
      'Content-Type': 'video/MP2T',
      'Cache-Control': 'no-cache',
    });

    // Stream the response directly to the client
    if (response.body) {
      response.body.pipe(res);
    } else {
      console.error('Response body is null');
      res.status(500).send('Internal Server Error');
    }
  } catch (error) {
    console.error('Error fetching .ts segment:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to proxy encryption keys (if present)
app.get('/proxy-key', async (req, res) => {
  const keyUrl = req.query.keyUrl;

  if (typeof keyUrl !== 'string') {
    res.status(400).send('Invalid URL');
    return;
  }
  
  if (!isValidUrl(keyUrl)) {
    res.status(403).send('Forbidden');
    return;
  }

  try {
    const response = await fetch(keyUrl, {
      headers: {
        'sec-ch-ua-platform': '"macOS"',
        Referer: ORIGINAL_REFERER,
        'User-Agent': ORIGINAL_USER_AGENT,
        'sec-ch-ua':
          '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
        DNT: '1',
        'sec-ch-ua-mobile': '?0',
      },
    });

    if (!response.ok) {
      res
        .status(response.status)
        .send(`Failed to fetch encryption key: ${response.statusText}`);
      return;
    }

    // Set appropriate headers for the client
    res.set({
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });

    // Stream the key directly to the client
    if (response.body) {
      response.body.pipe(res);
    } else {
      console.error('Response body is null');
      res.status(500).send('Internal Server Error');
    }
  } catch (error) {
    console.error('Error fetching encryption key:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Proxy server is running on port ${PORT}`);
});