import axios from 'axios';
axios.get('https://vidbing.com/embed/tv/37854/1/1', { timeout: 3000 }).then(res => console.log('vidbing', res.status)).catch(err => console.log('vidbing fail', err.message));
