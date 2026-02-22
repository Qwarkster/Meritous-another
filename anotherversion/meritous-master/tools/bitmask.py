#!/usr/bin/python3
# Convert bitmask from/to PNG
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

# "The format of the bitmap is as follows: Scanlines come in the usual
# top-down order. Each scanline consists of (width / 8) bytes, rounded
# up. The most significant bit of each byte represents the leftmost
# pixel."

import PIL.Image
import sys

def usage():
    print("Usage: ./bitmask.py [encode font.png | decode font.dat]")
    sys.exit(1)

if len(sys.argv) != 3:
    usage()

if sys.argv[1] == 'decode':
    f = open(sys.argv[2], 'rb')
    im = PIL.Image.new('1', (32,32))

    for scanline in range(0,32):
        for xpack in range(0,32//8):
            pixels = [int(i) for i in '{:08b}'.format(ord(f.read(1)))]
            for i in range(0,8):
                print(pixels[i], end='')
                im.putpixel((xpack*8+i,scanline), pixels[i])
        print()
    filename = sys.argv[2].replace('.dat', '.png')
    im.save(filename)
    print("wrote " + filename)

elif sys.argv[1] == 'encode':
    im = PIL.Image.open(sys.argv[2])
    filename = sys.argv[2].replace('.png', '.dat')
    f = open(filename, 'wb')
    for y in range(0,32):
        for xpack in range(0,32//8):
            val = 0
            for i in range(0,8):
                val |= (im.getpixel((xpack*8+i,y))//255) << i
            f.write(bytes([val]))
    print("wrote " + filename)

else:
    usage()
