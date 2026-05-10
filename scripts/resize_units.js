const { Jimp } = require("jimp");
const fs = require("fs");
const path = require("path");

async function main() {
    const dir = path.join(__dirname, "../src/assets/units");
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));

    for (const file of files) {
        const filePath = path.join(dir, file);
        console.log("Processing", filePath);
        const img = await Jimp.read(filePath);
        img.resize({ w: img.bitmap.width / 2, h: img.bitmap.height / 2 });
        await img.write(filePath);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
