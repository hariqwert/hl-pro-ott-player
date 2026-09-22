import axios from 'axios';

const urls = [
  'https://vidlink.pro/tv/37854/1/1',
  'https://vidrift.com/embed/tv?tmdb=37854&season=1&episode=1',
  'https://vidsrc.pm/embed/tv/37854/1/1',
  'https://vidsrc.to/embed/tv/37854/1/1',
  'https://vidsrc.in/embed/tv/37854/1/1',
  'https://filmu.stream/embed/tv/37854/1/1',
  'https://cinezo.com/tv/37854/1/1',
];

for (const url of urls) {
    axios.get(url, { timeout: 3000 }).then(res => console.log('OK', url, res.status)).catch(err => console.log('FAIL', url, err.message));
}
