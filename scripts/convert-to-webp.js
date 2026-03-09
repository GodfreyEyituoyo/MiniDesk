const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const conversions = [
    // High-end keyboards (POP Icon)
    { src: 'keyboard images/high end keyboard/graphite_white.png', out: 'images/keyboards/pop-icon-graphite-white-1.webp' },
    { src: 'keyboard images/high end keyboard/Graphite & Green.png', out: 'images/keyboards/pop-icon-graphite-green-1.webp' },
    { src: 'keyboard images/high end keyboard/Off White & Orange.png', out: 'images/keyboards/pop-icon-offwhite-orange-1.webp' },
    { src: 'keyboard images/high end keyboard/Rose & Off White.png', out: 'images/keyboards/pop-icon-rose-offwhite-1.webp' },
    { src: 'keyboard images/high end keyboard/Lilac & Off White.png', out: 'images/keyboards/pop-icon-lilac-offwhite-1.webp' },
    // Basic keyboards (MK250)
    { src: 'keyboard images/basic keyboard/graphite.png', out: 'images/keyboards/mk250-graphite-1.webp' },
    { src: 'keyboard images/basic keyboard/Off-white.png', out: 'images/keyboards/mk250-offwhite-1.webp' },
    { src: 'keyboard images/basic keyboard/Rose.png', out: 'images/keyboards/mk250-rose-1.webp' },
    // Monitors
    { src: 'images/monitor-entry.png', out: 'images/monitor-entry.webp' },
    { src: 'images/monitor-mid.png', out: 'images/monitor-mid.webp' },
    { src: 'images/monitor-top.png', out: 'images/monitor-top.webp' },
    { src: 'images/monitor-creator.png', out: 'images/monitor-creator.webp' },
    // Addons
    { src: 'images/addon-stand.png', out: 'images/addon-stand.webp' },
    { src: 'images/addon-ssd.png', out: 'images/addon-ssd.webp' },
    // Mac Mini
    { src: 'images/macmini-m4.jpg', out: 'images/macmini-m4.webp' },
];

(async () => {
    for (const { src, out } of conversions) {
        const srcPath = path.resolve(src);
        if (!fs.existsSync(srcPath)) {
            console.log(`⚠️  Skipping ${src} (not found)`);
            continue;
        }
        const isKeyboard = src.includes('keyboard');
        const width = isKeyboard ? 1000 : undefined; // Only resize keyboards
        try {
            let pipeline = sharp(srcPath);
            if (width) pipeline = pipeline.resize(width);
            await pipeline.webp({ quality: 82 }).toFile(path.resolve(out));
            const stats = fs.statSync(path.resolve(out));
            console.log(`✅ ${out} (${(stats.size / 1024).toFixed(0)}KB)`);
        } catch (e) {
            console.error(`❌ ${src}: ${e.message}`);
        }
    }
    console.log('\n🎉 Done!');
})();
