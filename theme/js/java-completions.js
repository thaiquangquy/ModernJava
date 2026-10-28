"use strict";

// Static, token-based Java completion for the challenge editors (see
// challengeEditing in theme/book.js). It is not type-aware: it offers
// keywords, a few well known types, members of those types after a ".",
// and snippets. Kept small on purpose so it doesn't suggest things the
// book hasn't taught yet.
window.javaCompletions = (function () {
  const KEYWORDS = [
    "abstract", "boolean", "break", "byte", "case", "char", "class", "continue",
    "default", "do", "double", "else", "enum", "extends", "final", "finally",
    "float", "for", "if", "implements", "import", "instanceof", "int",
    "interface", "long", "new", "null", "package", "permits", "private",
    "protected", "public", "record", "return", "sealed", "short", "static",
    "super", "switch", "this", "throw", "throws", "true", "false", "try",
    "var", "void", "while", "yield",
  ];

  const TYPES = [
    "String", "StringBuilder", "Integer", "Long", "Double", "Boolean",
    "Character", "Math", "Object", "Objects", "Optional", "List", "ArrayList",
    "Map", "HashMap", "Set", "HashSet", "Arrays", "Collections", "Stream",
    "Collectors", "Scanner", "Random", "Thread", "Runnable",
    "IllegalArgumentException", "IllegalStateException", "RuntimeException",
    "Exception", "IO",
  ];

  // Members offered after "<Type>."
  const STATIC_MEMBERS = {
    IO: ["println", "print", "readln"],
    Math: ["abs", "max", "min", "pow", "sqrt", "floor", "ceil", "round", "random", "PI", "E"],
    Integer: ["parseInt", "valueOf", "toString", "compare", "MAX_VALUE", "MIN_VALUE"],
    Long: ["parseLong", "valueOf", "toString", "compare", "MAX_VALUE", "MIN_VALUE"],
    Double: ["parseDouble", "valueOf", "toString", "compare", "isNaN", "MAX_VALUE", "MIN_VALUE"],
    Boolean: ["parseBoolean", "valueOf", "toString"],
    Character: ["isDigit", "isLetter", "isLetterOrDigit", "isUpperCase", "isLowerCase", "toUpperCase", "toLowerCase", "getNumericValue"],
    String: ["valueOf", "format", "join"],
    Objects: ["equals", "hash", "requireNonNull", "toString", "isNull", "nonNull"],
    Arrays: ["toString", "sort", "fill", "asList", "copyOf", "copyOfRange", "equals", "stream"],
    List: ["of", "copyOf"],
    Set: ["of", "copyOf"],
    Map: ["of", "entry", "copyOf"],
    Optional: ["of", "empty", "ofNullable"],
    Collections: ["sort", "reverse", "unmodifiableList", "max", "min", "emptyList"],
  };

  // Offered after "<anything>." when the receiver's type is unknown.
  const INSTANCE_MEMBERS = [
    "length", "charAt", "substring", "indexOf", "contains", "equals", "hashCode",
    "toString", "isEmpty", "toUpperCase", "toLowerCase", "trim", "split",
    "startsWith", "endsWith", "replace", "add", "get", "set", "remove", "size",
    "put", "containsKey", "getOrDefault", "keySet", "values", "entrySet",
    "forEach", "stream", "append", "compareTo", "intValue", "doubleValue",
  ];

  function items(names, meta, score) {
    return names.map(function (name) {
      return { caption: name, value: name, meta: meta, score: score };
    });
  }

  const completer = {
    identifierRegexps: [/[a-zA-Z_0-9$]/],
    getCompletions: function (editor, session, pos, prefix, callback) {
      const line = session.getLine(pos.row).slice(0, pos.column - prefix.length);
      const member = /([A-Za-z_$][\w$]*)\s*\.\s*$/.exec(line);

      if (member) {
        const statics = STATIC_MEMBERS[member[1]];
        if (statics) {
          return callback(null, items(statics, member[1], 1000));
        }
        return callback(null, items(INSTANCE_MEMBERS, "method", 500));
      }

      if (prefix.length === 0) {
        return callback(null, []);
      }
      callback(null, items(KEYWORDS, "keyword", 300).concat(items(TYPES, "type", 400)));
    },
  };

  const snippets = [
    { name: "main", trigger: "main", content: "void main() {\n\t${1}\n}" },
    { name: "println", trigger: "pl", content: "IO.println(${1});" },
    { name: "for", trigger: "fori", content: "for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t${3}\n}" },
    { name: "foreach", trigger: "foreach", content: "for (${1:var} ${2:item} : ${3:items}) {\n\t${4}\n}" },
    { name: "if", trigger: "if", content: "if (${1:condition}) {\n\t${2}\n}" },
    { name: "ifelse", trigger: "ifelse", content: "if (${1:condition}) {\n\t${2}\n} else {\n\t${3}\n}" },
    { name: "while", trigger: "while", content: "while (${1:condition}) {\n\t${2}\n}" },
    { name: "switch", trigger: "switch", content: "switch (${1:value}) {\n\tcase ${2:x} -> ${3};\n\tdefault -> ${4};\n}" },
    { name: "record", trigger: "record", content: "record ${1:Name}(${2:int x}) {}" },
    { name: "sealed", trigger: "sealed", content: "sealed interface ${1:Name} permits ${2:A}, ${3:B} {}" },
  ];

  return { completer: completer, snippets: snippets };
})();
