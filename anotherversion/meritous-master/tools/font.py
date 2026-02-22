#!/usr/bin/python3
# Convert bitmap font from/to PNG
# 
# Copyright (C) 2019 Sylvain Beucler
# 
# This file is part of Meritous.
# 
# Meritous is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
# 
# Meritous is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
# 
# You should have received a copy of the GNU General Public License
# along with Meritous.  If not, see <http://www.gnu.org/licenses/>.

# unsigned char font_data[128][8][8];
# font.dat contains 128 images, size 8x8, 8-bit greyscale format

import PIL.Image
import sys

def usage():
    print("Usage: ./font.py [encode font.png | decode font.dat]")
    sys.exit(1)

if len(sys.argv) != 3:
    usage()

if sys.argv[1] == 'decode':
    f = open(sys.argv[2], 'rb').read()
    im = PIL.Image.new('L', (128*8,8))

    for c in range(0,128):
        for x in range(0,8):
            for y in range(0,8):
                im.putpixel((c*8+x,y), f[c*8*8+y*8+x])
    filename = sys.argv[2].replace('.dat', '.png')
    im.save(filename)
    print("wrote " + filename)

elif sys.argv[1] == 'encode':
    im = PIL.Image.open(sys.argv[2])

    enc = bytearray(128*8*8)
    for c in range(0,128):
        for x in range(0,8):
            for y in range(0,8):
                v = im.getpixel((c*8+x,y))
                enc[c*8*8+y*8+x] = v
    filename = sys.argv[2].replace('.png', '.dat')
    open(filename, 'wb').write(enc)
    print("wrote " + filename)

else:
    usage()
