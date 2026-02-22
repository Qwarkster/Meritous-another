#
#   Makefile
#
#   Copyright 2007, 2008 Lancer-X/ASCEAI
#   Copyright 2013, 2019 Sylvain Beucler
#
#   This file is part of Meritous.
#
#   Meritous is free software: you can redistribute it and/or modify
#   it under the terms of the GNU General Public License as published by
#   the Free Software Foundation, either version 3 of the License, or
#   (at your option) any later version.
#
#   Meritous is distributed in the hope that it will be useful,
#   but WITHOUT ANY WARRANTY; without even the implied warranty of
#   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#   GNU General Public License for more details.
#
#   You should have received a copy of the GNU General Public License
#   along with Meritous.  If not, see <http://www.gnu.org/licenses/>.
#

# Automake-style terminology
DESTDIR=
prefix=/usr/local
bindir=$(prefix)/bin
datarootdir=$(prefix)/share
datadir=$(datarootdir)
pkgdatadir=$(datadir)/meritous
localedir=$(datarootdir)/locale

# Tools
INSTALL=install
MKDIR_P=$(INSTALL) -d -m 00755
CP_R=cp -r --preserve=timestamps

# Compilations flags
CFLAGS ?= -O2 -g -Wall
#CFLAGS := $(CFLAGS) $(shell sdl-config --cflags)  # only work for env
override CFLAGS += $(shell sdl-config --cflags)    # work both env and cmdline
override CPPFLAGS += -MD -MP -DDATADIR='"$(pkgdatadir)"' -DLOCALEDIR='"$(localedir)"'
LDLIBS = -lSDL_mixer -lSDL_image $(shell sdl-config --libs) -lz -lm

all: meritous
.PHONY: all clean po/meritous.pot

OBJS = 	src/levelblit.o \
	src/mapgen.o \
	src/demon.o \
	src/gamemap.o \
	src/tiles.o \
	src/save.o \
	src/help.o \
	src/audio.o \
	src/boss.o \
	src/ending.o \
	src/i18n.o
DEPS = $(OBJS:.o=.d)
-include $(DEPS)

meritous: $(OBJS)
	$(CC) $(CFLAGS) $(LDFLAGS) $+ $(LDLIBS) -o $@

po/meritous.pot:
	cd po; intltool-update --pot --gettext-package=meritous

po/%.po: po/meritous.pot
	cd po; intltool-update --dist --gettext-package=meritous $*

install: meritous
	$(MKDIR_P) "$(DESTDIR)$(bindir)"
	$(INSTALL) meritous "$(DESTDIR)$(bindir)"

	$(MKDIR_P) "$(DESTDIR)$(pkgdatadir)"
	$(CP_R) dat/* "$(DESTDIR)$(pkgdatadir)/"

	$(MKDIR_P) "$(DESTDIR)$(localedir)"
	for i in $$(cd po/ && ls *.po | sed 's/\.po$$//'); do \
		$(MKDIR_P) "$(DESTDIR)$(localedir)/$$i/LC_MESSAGES/"; \
		msgfmt --statistics po/$$i.po -o "$(DESTDIR)$(localedir)/$$i/LC_MESSAGES/meritous.mo"; \
	done

	$(MKDIR_P) "$(DESTDIR)$(datarootdir)/applications"
	$(MKDIR_P) "$(DESTDIR)$(datarootdir)/metainfo"
	$(MKDIR_P) "$(DESTDIR)$(datarootdir)/icons/hicolor/256x256/apps"
	$(MKDIR_P) "$(DESTDIR)$(datarootdir)/icons/hicolor/scalable/apps"
	intltool-merge -d -u po/ share/applications/net.asceai.meritous.desktop.in "$(DESTDIR)$(datarootdir)/applications/net.asceai.meritous.desktop"
	intltool-merge -x -u po/ share/metainfo/net.asceai.meritous.appdata.xml.in "$(DESTDIR)$(datarootdir)/metainfo/net.asceai.meritous.appdata.xml"
	$(CP_R) share/icons/hicolor/256x256/apps/meritous.png "$(DESTDIR)$(datarootdir)/icons/hicolor/256x256/apps/"
	$(CP_R) share/icons/hicolor/scalable/apps/meritous.svg "$(DESTDIR)$(datarootdir)/icons/hicolor/scalable/apps/"

	$(MKDIR_P) "$(DESTDIR)$(datarootdir)/man/man6/"
	$(CP_R) share/man/man6/meritous.6 "$(DESTDIR)$(datarootdir)/man/man6/"

uninstall:
	rm -f "$(DESTDIR)$(bindir)/meritous"
	rm -rf "$(DESTDIR)$(pkgdatadir)/a/"
	rm -rf "$(DESTDIR)$(pkgdatadir)/d/"
	rm -rf "$(DESTDIR)$(pkgdatadir)/i/"
	rm -rf "$(DESTDIR)$(pkgdatadir)/m/"
	for i in $$(cd po/ && ls ??.po | sed 's/\.po$$//'); do \
		rm -f "$(DESTDIR)$(localedir)/$$i/LC_MESSAGES/meritous.mo"; \
	done
	rm -f "$(DESTDIR)$(datarootdir)/applications/net.asceai.meritous.desktop"
	rm -f "$(DESTDIR)$(datarootdir)/metainfo/net.asceai.meritous.appdata.xml"
	rm -f "$(DESTDIR)$(datarootdir)/icons/hicolor/256x256/apps/meritous.png"
	rm -f "$(DESTDIR)$(datarootdir)/icons/hicolor/scalable/apps/meritous.svg"

	rm -f "$(DESTDIR)$(datarootdir)/man/man6/meritous.6"

clean:		
	rm -f $(OBJS) $(DEPS) meritous po/*.mo
