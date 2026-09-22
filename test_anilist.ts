import { META } from '@consumet/extensions';
async function test() {
    const anilist = new META.Anilist();
    const res = await anilist.search("Naruto");
    console.log(res.results[0]);
    const info = await anilist.fetchAnimeInfo(res.results[0].id);
    console.log(info.title);
}
test().catch(console.error);
