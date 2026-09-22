import axios from 'axios';
axios.get('https://bingr.one/api/details/tv/37854', {
  headers: {
    'Origin': 'https://bingr.one',
    'Referer': 'https://bingr.one/'
  }
})
.then(res => console.log(JSON.stringify(res.data.seasons)))
.catch(err => console.log(err));
