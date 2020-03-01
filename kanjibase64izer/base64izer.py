# os import
import os
# regular expression operations
import re
import base64
from errno import ENOENT as FILE_NOT_FOUND
import sys
import csv

try:
    import argparse
except ModuleNotFoundError:
    from . import argparse  # Anki add-on

# Setup
source_directory = os.path.join(os.path.dirname(__file__),
                                'data', 'kanjivg', 'kanji')

# Classes

class KanjiVG(object):
    '''
    Class to create kanji objects containing KanjiVG data and some more
    basic qualities of the character
    '''
    def __init__(self, character, variant=''):
        '''
        Create a new KanjiVG object
        Either give just the character
        >>> k1 = KanjiVG('漢')
        >>> print(k1.character)
        漢
        >>> k1.variant
        ''
        Or if the character has a variant, give that as a second
        argument
        >>> k2 = KanjiVG('字', 'Kaisho')
        >>> print(k2.character)
        字
        >>> k2.variant
        'Kaisho'
        Raises InvalidCharacterError if the character and variant don't
        correspond to known data
        >>> k = KanjiVG('Л')
        Traceback (most recent call last):
            ...
        kanjicolorizer.colorizer.InvalidCharacterError: ('\\u041b', '')
        '''
        self.character = character
        self.variant = variant
        if self.variant is None:
            self.variant = ''
        try:
            with open(os.path.join(source_directory, self.ascii_filename),
                      'r', encoding='utf-8') as f:
                self.svg = f.read()
        except IOError as e:  # file not found
            if e.errno == FILE_NOT_FOUND:
                raise InvalidCharacterError(character, variant) from e
            else:
                raise

    @classmethod
    def _create_from_filename(cls, filename):
        '''
        Alternate constructor that uses a KanjiVG filename; used by
        get_all().
        >>> k = KanjiVG._create_from_filename('00061.svg')
        >>> k.character
        'a'
        '''
        m = re.match('^([0-9a-f]*)-?(.*?).svg$', filename)
        return cls(chr(int(m.group(1), 16)), m.group(2))

    @property
    def ascii_filename(self):
        '''
        An SVG filename in ASCII using the same format KanjiVG uses.
        >>> k = KanjiVG('漢')
        >>> k.ascii_filename
        '06f22.svg'
        May raise InvalidCharacterError for some kinds of invalid
        character/variant combinations; this should only happen during
        KanjiVG object initialization.
        '''
        try:
            code = '%05x' % ord(self.character)
        except TypeError:  # character not a character
            raise InvalidCharacterError(self.character, self.variant)
        if not self.variant:
            return code + '.svg'
        else:
            return '%s-%s.svg' % (code, self.variant)

    @property
    def character_filename(self):
        '''
        An SVG filename that uses the unicode character
        >>> k = KanjiVG('漢')
        >>> print(k.character_filename)
        漢.svg
        '''
        if not self.variant:
            return '%s.svg' % self.character
        else:
            return '%s-%s.svg' % (self.character, self.variant)

    @classmethod
    def get_all(cls, ignoreVariants = False):
        '''
        Returns a complete list of KanjiVG objects; everything there is
        data for
        >>> kanji_list = KanjiVG.get_all()
        >>> kanji_list[0].__class__.__name__
        'KanjiVG'
        '''
        kanji = []
        for file in os.listdir(source_directory):
            if (ignoreVariants is True and file.find("-") != -1):
                continue

            kanji.append(cls._create_from_filename(file))
        return kanji

class KanjiBase64izer:
    def __init__(self, argstring=""):
        self._init_parser()
        if (len(argstring) > 0):
            self.read_arg_string(argstring)

    # Parse configuration
    def _init_parser(self):
        self._parser = argparse.ArgumentParser(description="Output a Base64 encoding of the SVG file")
        self._parser.add_argument("--remove-numbers", default=False, type=bool, help="Remove the stroke numbers from the SVG element")
        self._parser.add_argument("--preferred-variant", type=str, help="If there is a variant of the requested Kanji, pick that instead")
        self._parser.add_argument("--character", type=str, required=True, help="The character that you want to get the Base64 value of")

    # do a command line approach where it outputs the base64 value of a kanji
    def read_cl_args(self):
        self.settings = self._parser.parse_args()

    def read_arg_string(self, argstring):
        self.settings = self._parser.parse_args(argstring.split())

    # write all the kanji base64 to a CSV file
    def write_all_to_file(self):
        characters = KanjiVG.get_all(ignoreVariants=True)
        dst_csv_path = os.path.join(os.path.curdir, "kanji.csv")
        # mark BOM for UTF-8
        with open(dst_csv_path, "w", encoding="utf_8_sig") as f:
            f.write("")
        
        for kanji in characters:
            dataRow = [kanji.character, self.svg_to_base64(kanji)]
            with open(dst_csv_path, "a", newline="", encoding="utf_8_sig") as f:
                writer = csv.writer(f, delimiter=",")
                writer.writerow(dataRow)

    def svg_to_base64(self, kanjiVGObject):
        svg = kanjiVGObject.svg
        svgText = re.findall("<svg.*?<\/svg>", svg, re.DOTALL)[0]
        if (self.settings.remove_numbers):
            svgText = self._remove_strokes(svgText)

        encodedBytes = base64.b64encode(svgText.encode("utf-8"))
        encodedStr = str(encodedBytes, "utf-8")
        return encodedStr

    # this is where the magic happens
    def get_base64_svg(self, character = None):
        # Character is added from arguments
        character = (character is None) and self.settings.character or character
        kanjiVGObject = KanjiVG(character, self.settings.preferred_variant)
        return self.svg_to_base64(kanjiVGObject)

    # we don't need a write_all cause it doesn't make sense in this context
    # what we want is that it returns a value on demand
    def _remove_strokes(self, svg):
        return re.sub("<text.*?</text>", "", svg)

    # Get coressponding Kanji filename
    # e.g. '00061.svg'
    def _get_dst_filename(self, kanji):
        if (self.settings.filename_mode == 'character'):
            return kanji.character_filename
        else:
            return kanji.ascii_filename

    # Add copyright function?
    # Add resize svg?
    # Add stroke count?


# Exceptions

class Error(Exception):
    '''
    Base class for this module's exceptions
    '''
    pass


class InvalidCharacterError(Error):
    '''
    Exception thrown when trying to initialize or use a character that
    there isn't data for
    '''
    pass


# Test if run

if __name__ == "__main__":
    import doctest
    doctest.testmod()