/* ===========================================================================
   A minimal, dependency-free ZIP writer.

   Why not just shell out? Because `Compress-Archive` on Windows writes
   BACKSLASHES as the path separator inside the archive:

       wwf-scrollmap\block.json        ← what PowerShell produced
       wwf-scrollmap/block.json        ← what the ZIP spec (APPNOTE 4.4.17.1)
                                         requires, and what PHP reads

   PHP's unzip on Linux then sees one flat file called "wwf-scrollmap\block.json"
   instead of a folder, so WordPress finds no top-level plugin directory, names
   the folder after the zip instead, and the plugin will not load. That bug is
   invisible on a Windows dev machine and fatal on a real server, so the build
   does not delegate it.
   ======================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---- CRC-32 (the zip checksum) ----------------------------------------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/* DOS date/time. Fixed, so the same input always produces byte-identical
   output — reproducible builds, and a meaningful `git diff` on the artefact. */
const DOS_TIME = 0x0000;
const DOS_DATE = 0x2821;   // 2000-01-01

/**
 * @param {string} zipPath        where to write
 * @param {Array<{name:string, data:Buffer}>} entries  name uses FORWARD slashes
 */
function writeZip(zipPath, entries) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const e of entries) {
    const name = Buffer.from(e.name.split(path.sep).join('/'), 'utf8');
    const crc = crc32(e.data);
    const deflated = zlib.deflateRawSync(e.data, { level: 9 });
    // Only compress if it actually helps; otherwise store.
    const useDeflate = deflated.length < e.data.length;
    const body = useDeflate ? deflated : e.data;
    const method = useDeflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);   // local file header signature
    local.writeUInt16LE(20, 4);           // version needed
    local.writeUInt16LE(0x0800, 6);       // flags: UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, body);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);      // central directory signature
    cd.writeUInt16LE(0x031e, 4);          // made by: UNIX
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(DOS_TIME, 12);
    cd.writeUInt16LE(DOS_DATE, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(e.data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(0, 38);              // external attrs
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);

    offset += local.length + name.length + body.length;
  }

  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  fs.writeFileSync(zipPath, Buffer.concat([...locals, cdBuf, end]));
}

module.exports = { writeZip, crc32 };
