import sharp from 'sharp';
import { readFileSync } from 'fs';

const svg = readFileSync('./public/icon.svg');

await sharp(svg).resize(192, 192).toFile('./public/icon-192.png');
console.log('Generated icon-192.png');

await sharp(svg).resize(512, 512).toFile('./public/icon-512.png');
console.log('Generated icon-512.png');

await sharp(svg).resize(180, 180).toFile('./public/apple-touch-icon.png');
console.log('Generated apple-touch-icon.png');

console.log('All icons generated successfully.');
