import sharp from 'sharp';
const result=await sharp({create:{width:1,height:1,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).png().toBuffer();
if(!result.length)throw Error('Image decoder unavailable');
console.log(JSON.stringify({node:process.versions.node,sharp:sharp.versions.sharp,runtime_ready:true}));
