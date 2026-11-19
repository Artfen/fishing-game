// The recorded sounds (docs/SOUND.md): what each file is, where it came from, who recorded it and
// under what licence, and how it was cut. tools/sounds.mjs makes assets/sounds/ from this; audio.js
// plays what it makes; tests/sound.test.mjs holds the files to it. Only recordings anyone may use
// for anything: public domain or CC0.
//
// loop: seconds of a seamless loop (its end cross-faded into its start), padded LOOP_PAD either
// side with its own continuation, so a player that doesn't trim an MP3's start still loops clean
// (audio.js loops LOOP_PAD … LOOP_PAD + loop). from: where in the source it starts (s).

export const SOUND_DIR = 'assets/sounds/';
export const LOOP_PAD = 0.25;
export const LOOP_FADE = 1.5;

const APOREE_PD = 'Public domain, as marked by its recordist (Public Domain Mark 1.0)';
export const LICENCES = {
  pdm: APOREE_PD,
  cc0: 'CC0 1.0 (public domain dedication)',
  usgov: 'Public domain (a work of the U.S. government)',
};

export const SOUNDS = {
  shoreCalm: {
    file: 'shore-calm.mp3', loop: 28, from: 3.5,
    what: 'Small waves on a sandy beach',
    source: { title: 'Frederiksvej 16, 3730 Nexø, Denmark - Small waves', by: 'Benjamin Trimoreau', licence: 'pdm', page: 'https://archive.org/details/aporee_41291_47108', file: 'https://archive.org/download/aporee_41291_47108/Aporee170514001smallwaves.ogg', recorded: '2017-05-14' },
  },
  shoreRough: {
    file: 'shore-rough.mp3', loop: 30, from: 45,
    what: 'Strong sea waves on a shingle beach on a windy evening',
    source: { title: 'Brighton Beach, East Sussex, UK - Strong sea waves', by: 'Rory Smith (RorySmith)', licence: 'pdm', page: 'https://archive.org/details/aporee_27515_31722', file: 'https://archive.org/download/aporee_27515_31722/Strongseawaves.ogg', recorded: '2015-03-31' },
  },
  harbour: {
    file: 'harbour.mp3', loop: 30, from: 29.5,
    what: 'A marina: ropes striking a mast, the wind, gulls',
    source: { title: 'Nabrzeże Beniowskiego, Gdynia, Polska - Ropes striking the mast of a small yacht', by: 'wpioter', licence: 'pdm', page: 'https://archive.org/details/aporee_38745_44263', file: 'https://archive.org/download/aporee_38745_44263/LS110236Gdyniamarina29102016.ogg', recorded: '2016-10-29' },
  },
  rain: {
    file: 'rain.mp3', loop: 30, from: 42.5, highpass: 220,
    what: 'Light rain in woods (its distant thunder filtered out: the game has its own)',
    source: { title: 'Light Rain Distant Thunder July 5th 2016', by: 'kvgarlic (Freesound)', licence: 'cc0', page: 'https://commons.wikimedia.org/wiki/File:Light_Rain_Distant_Thunder_July_5th_2016.wav', file: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/b/b6/Light_Rain_Distant_Thunder_July_5th_2016.wav/Light_Rain_Distant_Thunder_July_5th_2016.wav.mp3', recorded: '2016-07-05' },
  },
};
// A herring gull's flight calls, each its own short file (cut from one recording).
const GULL = { title: 'XC707075 - European Herring Gull - Larus argentatus', by: 'Sonothèque ADVL (xeno-canto)', licence: 'cc0', page: 'https://commons.wikimedia.org/wiki/File:XC707075_-_European_Herring_Gull_-_Larus_argentatus.mp3', file: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/XC707075_-_European_Herring_Gull_-_Larus_argentatus.mp3', recorded: 'Carolles, Normandy' };
[[5.54, 5.86], [6.22, 6.76], [7.04, 7.64], [8.04, 8.5]].forEach(([from, to], i) => {
  SOUNDS[`gull${i + 1}`] = { file: `gull-${i + 1}.mp3`, from, to, highpass: 300, what: 'A herring gull’s flight call', source: GULL };
});
export const GULL_CALLS = Object.keys(SOUNDS).filter((k) => k.startsWith('gull'));
export const LOOPS = Object.keys(SOUNDS).filter((k) => SOUNDS[k].loop);
