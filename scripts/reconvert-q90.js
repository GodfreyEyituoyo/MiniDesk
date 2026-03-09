const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const conversions = [
    { src: 'keyboard images/high end keyboard/graphite_white.png', out: 'images/keyboards/pop-icon-graphite-white-1.webp' },
    { src: 'keyboard images/high end keyboard/Graphite & Green.png', out: 'images/keyboards/pop-icon-graphite-green-1.webp' },
    { src: 'keyboard images/high end keyboard/Off White & Orange.png', out: 'images/keyboards/pop-icon-offwhite-orange-1.webp' },
    { src: 'keyboard images/high end keyboard/Rose & Off White.png', out: 'images/keyboards/pop-icon-rose-offwhite-1.webp' },
    { src: 'keyboard images/high end keyboard/Lilac & Off White.png', out: 'images/keyboards/pop-icon-lilac-offwhite-1.webp' },
    { src: 'keyboard images/basic keyboard/graphite.png', out: 'images/keyboards/mk250-graphite-1.webp' },
    { src: 'keyboard images/basic keyboard/Off-white.png', out: 'images/keyboards/mk250-offwhite-1.webp' },
    { src: 'keyboard images/basic keyboard/Rose.png', out: 'images/keyboards/mk250-rose-1.webp' },
];

(async () => {
    for (const { src, out } of conversions) {
        const srcPath = path.resolve(src);
        if (!fs.existsSync(srcPath)) { console.log('SKIP: ' + src); continue; }
        const meta = await sharp(srcPath).metadata();
        console.log(path.basename(src) + ': ' + meta.width + 'x' + meta.height + ' channels=' + meta.channels + ' hasAlpha=' + meta.hasAlpha);
        await sharp(srcPath).resize(1000).webp({ quality: 90 }).toFile(path.resolve(out));
        const stats = fs.statSync(path.resolve(out));
        console.log('  => ' + out + ' (' + (stats.size / 1024).toFixed(0) + 'KB)');
    }
    console.log('\nDone!');
})();
