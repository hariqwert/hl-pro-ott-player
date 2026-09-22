import axios from 'axios';
axios.get('https://api.themoviedb.org/3/tv/37854?api_key=4d360ecb39d7fcba0b2408c1db16d004') // One Piece
.then(res => console.log(res.data.seasons[0]))
.catch(err => console.log(err));
