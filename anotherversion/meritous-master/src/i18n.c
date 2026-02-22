//
//   i18n.c
//
//   This file is part of Meritous.
//
//   Meritous is free software: you can redistribute it and/or modify
//   it under the terms of the GNU General Public License as published by
//   the Free Software Foundation, either version 3 of the License, or
//   (at your option) any later version.
//
//   Meritous is distributed in the hope that it will be useful,
//   but WITHOUT ANY WARRANTY; without even the implied warranty of
//   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//   GNU General Public License for more details.
//
//   You should have received a copy of the GNU General Public License
//   along with Meritous.  If not, see <http://www.gnu.org/licenses/>.
//

#include "i18n.h"

#include <stddef.h>

/**
 * Filter out empty strings: "When an empty string is used for msgid,
 * the functions may return a nonempty string." - gettext(3)
 */
char* i18n_nonempty(const char *__msgid) {
	if (__msgid == NULL || __msgid[0] == '\0') {
		return "";
	} else {
		return gettext(__msgid);
	}
}
