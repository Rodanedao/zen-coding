/**
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * @include "settings.js"
 * @include "/EclipseMonkey/scripts/monkey-doc.js"
 */
	
	var re_tag = /<\/?[\w:\-]+(?:\s+[\w\-:]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*\s*(\/?)>$/;
	
	var TYPE_ABBREVIATION = 'zen-tag',
		TYPE_EXPANDO = 'zen-expando',
	
		/** Reference to another abbreviation or tag */
		TYPE_REFERENCE = 'zen-reference';
	
	/**
	 * Проверяет, является ли символ допустимым в аббревиатуре
	 * @param {String} ch
	 * @return {Boolean}
	 */
	function isAllowedChar(ch) {
		var char_code = ch.charCodeAt(0),
			special_chars = '#.>+*:$-_!@';
		
		return (char_code > 64 && char_code < 91)       // uppercase letter
				|| (char_code > 96 && char_code < 123)  // lowercase letter
				|| (char_code > 47 && char_code < 58)   // number
				|| special_chars.indexOf(ch) != -1;     // special character
	}
	
	/**
	 * Возвращает символ перевода строки, используемый в редакторе
	 * @return {String}
	 */
	function getNewline() {
		return editors.activeEditor.lineDelimiter;
	}
	
	/**
	 * Trim whitespace from string
	 * @param {String} text
	 * @return {String}
	 */
	function trim(text) {
		return (text || "").replace( /^\s+|\s+$/g, "" );
	}
	
	/**
	 * Helper function that transforms string into hash
	 * @return {Object}
	 */
	function stringToHash(str){
		var obj = {}, items = str.split(",");
		for ( var i = 0; i < items.length; i++ )
			obj[ items[i] ] = true;
		return obj;
	}
	
	/**
	 * Отбивает текст отступами
	 * @param {String} text Текст, который нужно отбить
	 * @param {String|Number} pad Количество отступов или сам отступ
	 * @return {String}
	 */
	function padString(text, pad) {
		var pad_str = '', result = '';
		if (typeof(pad) == 'number')
			for (var i = 0; i < pad; i++) 
				pad_str += zen_settings.indentation;
		else
			pad_str = pad;
		
		// бьем текст на строки и отбиваем все, кроме первой, строки
		var nl = getNewline(), 
			lines = text.split(new RegExp('\\r?\\n|' + nl));
			
		result += lines[0];
		for (var j = 1; j < lines.length; j++) 
			result += nl + pad_str + lines[j];
			
		return result;
	}
	
	/**
	 * Get the type of the partition based on the current offset
	
	/**
	 * Проверяет, является ли аббревиатура сниппетом
	 * @param {String} abbr
	 * @param {String} type
	 * @return {Boolean}
	 */
	function isShippet(abbr, type) {
		var res = zen_settings[type || 'html'];
		return res.snippets && zen_settings[type || 'html'].snippets[abbr] ? true : false;
	}
	
	/**
	 * Проверяет, закачивается ли строка полноценным тэгом. В основном 
	 * используется для проверки принадлежности символа '>' аббревиатуре 
	 * или тэгу
	 * @param {String} str
	 * @return {Boolean}
	 */
	function isEndsWithTag(str) {
		return re_tag.test(str);
	}
	
	/**
	 * Returns specified elements collection (like 'empty', 'block_level') from
	 * <code>resource</code>. If collections wasn't found, returns empty object
	 * @param {Object} resource
	 * @param {String} type
	 * @return {Object}
	 */
	function getElementsCollection(resource, type) {
		if (resource.element_types)
			return resource.element_types[type] || {}
		else
			return {};
	}
	
	/**
	 * Тэг
	 * @class
	 * @param {String} name Имя тэга
	 * @param {Number} count Сколько раз вывести тэг (по умолчанию: 1)
	 * @param {String} type Тип тэга (html, xml)
	 */
	function Tag(name, count, type) {
		name = name.toLowerCase();
		type = type || 'html';
		
		 var abbr = zen_settings[type].abbreviations[name];
		 if (abbr && abbr.type == TYPE_REFERENCE)
		 	abbr = zen_settings[type].abbreviations[abbr.value];
		 	
		this.name = (abbr) ? abbr.value.name : name;
		this.count = count || 1;
		this.children = [];
		this.attributes = [];
		this._abbr = abbr;
		this._res = zen_settings[type];
		
		// add default attributes
		if (this._abbr && this._abbr.value.attributes) {
			var def_attrs = this._abbr.value.attributes;
				for (var i = 0; i < def_attrs.length; i++) {
					var attr = def_attrs[i];
					this.addAttribute(attr.name, attr.value);
				}
			}
		}
	}
	
	Tag.prototype = {
		/**
		 * Добавляет нового потомка
		 * @param {Tag} tag
		 */
		addChild: function(tag) {
			this.children.push(tag);
		},
		
		/**
		 * Добавляет атрибут
		 * @param {String} name Название атрибута
		 * @param {String} value Значение атрибута
		 */
		addAttribute: function(name, value) {
			this.attributes.push({name: name, value: value});
		},
		
		/**
		 * Проверяет, является ли текущий элемент пустым
		 * @return {Boolean}
		 */
		isEmpty: function() {
			return (this._abbr && this._abbr.value.is_empty) || (this.name in getElementsCollection(this._res, 'empty'));
		},
		
		/**
		 * Проверяет, является ли текущий элемент строчным
		 * @return {Boolean}
		 */
		isInline: function() {
			return (this.name in getElementsCollection(this._res, 'inline_level'));
		},
		
		/**
		 * Проверяет, является ли текущий элемент блочным
		 * @return {Boolean}
		 */
		isBlock: function() {
			return (this.name in getElementsCollection(this._res, 'block_level'));
		},
		
		/**
		 * Проверяет, есть ли блочные потомки у текущего тэга. 
		 * Используется для форматирования
		 * @return {Boolean}
		 */
		hasBlockChildren: function() {
			for (var i = 0; i < this.children.length; i++) {
				if (this.children[i].isBlock())
					return true;
			}
			
			return false;
		},
		
		/**
		 * Преобразует тэг в строку. Если будет передан аргумент 
		 * <code>format</code> — вывод будет отформатирован согласно настройкам
		 * в <code>zen_settings</code>. Также в этом случае будет ставится 
		 * символ «|», означающий место вставки курсора. Курсор будет ставится
		 * в пустых атрибутах и элементах без потомков
		 * @param {Boolean} format Форматировать вывод
		 * @param {Boolean} indent Добавлять отступ
		 * @return {String}
		 */
		toString: function(format, indent) {
			var result = [], 
				attrs = '', 
				content = '', 
				start_tag = '', 
				end_tag = '',
				cursor = format ? '|' : '',
				a;

			indent = indent || false;
				
			// делаем строку атрибутов
			for (var i = 0; i < this.attributes.length; i++) {
				a = this.attributes[i];
				attrs += ' ' + a.name + '="' + (a.value || cursor) + '"';
			}
			
			// выводим потомков
			if (!this.isEmpty())
				for (var j = 0; j < this.children.length; j++) {
					content += this.children[j].toString(format, true);
					if (format && this.children[j].isBlock() && j != this.children.length - 1)
						content += getNewline();
				}
			
			if (this.name) {
				if (this.isEmpty()) {
					start_tag = '<' + this.name + attrs + ' />';
				} else {
					start_tag = '<' + this.name + attrs + '>';
					end_tag = '</' + this.name + '>';
				}
			}
			
			// форматируем вывод
			if (format) {
				if (this.name && this.hasBlockChildren()) {
					start_tag += getNewline() + zen_settings.indentation;
					end_tag = getNewline() + end_tag;
				}
				
				if (content)
					content = padString(content, indent ? 1 : 0);
				else
					start_tag += cursor;
					
			}
					
			// выводим тэг нужное количество раз
			for (var i = 0; i < this.count; i++) 
				result.push(start_tag.replace(/\$/g, i + 1) + content + end_tag);
			
			return result.join(format && this.isBlock() ? getNewline() : '');
		}
	};
	
	function Snippet(name, count, type) {
		/** @type {String} */
		this.name = name;
		this.count = count || 1;
		this.children = [];
		this._res = zen_settings[type || 'html'];
	}
	
	Snippet.prototype = {
		/**
		 * Добавляет нового потомка
		 * @param {Tag} tag
		 */
		addChild: function(tag) {
			this.children.push(tag);
		},
		
		addAttribute: function(){
		},
		
		isBlock: function() {
			return true; 
		},
		
		toString: function(format, indent) {
			indent = indent || false;
			
			var content = '', 
				result = [], 
				data = this._res.snippets[this.name],
				begin = '',
				end = '',
				child_padding = '',
				child_token = '${child}';
			
			if (data) {
				if (format) {
					var nl = getNewline();
					data = data.replace(/\n/g, nl);
					// нужно узнать, какой отступ должен быть у потомков
					var lines = data.split(nl);
					for (var j = 0; j < lines.length; j++) {
						if (lines[j].indexOf(child_token) != -1) {
							child_padding =  (m = lines[j].match(/(^\s+)/)) ? m[1] : '';
							break;
						}
					}
				}
				
				var parts = data.split(child_token);
				begin = parts[0] || '';
				end = parts[1] || '';
			}
			
			for (var i = 0; i < this.children.length; i++) {
				content += this.children[i].toString(format, true);
				if (format && this.children[i].isBlock() && i != this.children.length - 1)
					content += getNewline();
			}
			
			if (child_padding)
				content = padString(content, child_padding);
			
			
			// выводим тэг нужное количество раз
			for (var i = 0; i < this.count; i++) 
				result.push(begin.replace(/\$/g, i + 1) + content + end);
			
			return result.join(format ? getNewline() : '');
		}
	}
	
	return {
		/**
		 * Ищет аббревиатуру в текущем редакторе и возвращает ее
		 * @return {String|null}
		 * TODO move to Eclipse specific file
		 */
		findAbbreviation: function() {
			/** Текущий редактор */
			var editor = editors.activeEditor;
			
			if (editor.selectionRange.startingOffset != editor.selectionRange.endingOffset) {
				// пользователь сам выделил нужную аббревиатуру
				return editor.source.substring(editor.selectionRange.startingOffset, editor.selectionRange.endingOffset);
			}
			
			// будем искать аббревиатуру с текущей позиции каретки
			var original_offset = editor.currentOffset,
				cur_line = editor.getLineAtOffset(original_offset),
				line_offset = editor.getOffsetAtLine(cur_line);
			
			return this.extractAbbreviation(editor.source.substring(line_offset, original_offset));
		},
		
		/**
		 * Извлекает аббревиатуру из строки
		 * @param {String} str
		 * @return {String} Аббревиатура или пустая строка
		 */
		extractAbbreviation: function(str) {
			var cur_offset = str.length,
				start_index = -1;
			
			while (true) {
				cur_offset--;
				if (cur_offset < 0) {
					// дошли до начала строки
					start_index = 0;
					break;
				}
				
				var ch = str.charAt(cur_offset);
				
				if (!isAllowedChar(ch) || (ch == '>' && isEndsWithTag(str.substring(0, cur_offset + 1)))) {
					start_index = cur_offset + 1;
					break;
				}
			}
			
			if (start_index != -1) 
				// что-то нашли, возвращаем аббревиатуру
				return str.substring(start_index);
			else
				return '';
		},
		
		/**
		 * Преобразует аббревиатуру в дерево элементов
		 * @param {String} abbr Аббревиатура
		 * @param {String} type Тип документа (xsl, html)
		 * @return {Tag}
		 */
		parseIntoTree: function(abbr, type) {
			type = type || 'html';
			var root = new Tag('', 1, type),
				parent = root,
				last = null,
				res = zen_settings[type],
				re = /([\+>])?([a-z][a-z0-9:\!\-]*)(#[\w\-\$]+)?((?:\.[\w\-\$]+)*)(?:\*(\d+))?/ig;
			
			if (!abbr)
				return null;
			
			// replace expandos
			abbr = abbr.replace(/([a-z][\w\:\-]*)\+$/i, function(str){
				return (res.abbreviations[str]) ? res.abbreviations[str].value : str;
			});
			
			abbr = abbr.replace(re, function(str, operator, tag_name, id, class_name, multiplier){
				multiplier = multiplier ? parseInt(multiplier) : 1;
				
				var current = isShippet(tag_name, type) ? new Snippet(tag_name, multiplier, type) : new Tag(tag_name, multiplier, type);
				if (id)
					current.addAttribute('id', id.substr(1));
				
				if (class_name) 
					current.addAttribute('class', class_name.substr(1).replace(/\./g, ' '));
				
				
				// dive into tree
				if (operator == '>' && last)
					parent = last;
					
				parent.addChild(current);
				
				last = current;
				return '';
			});
			
			// empty 'abbr' string means that abbreviation was successfully expanded,
			// if not—abbreviation wasn't valid 
			return (!abbr) ? root : null;
		},
		
		/**
		 * Отбивает текст отступами
		 * @param {String} text Текст, который нужно отбить
		 * @param {String|Number} pad Количество отступов или сам отступ
		 * @return {String}
		 */
		padString: padString,
		getNewline: getNewline,
		
		/**
		 * Ищет новую точку вставки каретки
			offset = offset || 0;
		
		/**
		 * Возвращает тип текущего редактора (css или html)
		 * TODO move to Eclipse-specific file
		
		/**
		 * Возвращает отступ текущей строки у редактора
		 * @return {String}
		 */
		getCurrentLinePadding: function() {
			var editor = editors.activeEditor,
				cur_line_num = editor.getLineAtOffset(editor.selectionRange.startingOffset),
				end_offset = editor.getOffsetAtLine(cur_line_num + 1) + getNewline().length,
				cur_line = editor.source.substring(editor.getOffsetAtLine(cur_line_num), end_offset);
		
		settings_parser: (function(){
			/**
			 * Unified object for parsed data
			 */
			function entry(type, key, value) {
				return {
					type: type,
					key: key,
					value: value
				};
			}
			
			/** Regular expression for XML tag matching */
			var re_tag = /^<([\w\-]+(?:\:\w+)?)((?:\s+[\w\-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/,
				
				re_attrs = /([\w\-]+)\s*=\s*(['"])(.*?)\2/g;
			
			/**
			 * Make expando from string
			 * @param {String} key
			 * @param {String} value
			 * @return {Object}
			 */
			function makeExpando(key, value) {
//				if (key.substr(-1) == '+') 
//					key = key.substring(0, key.length - 2);	
				
				return entry(TYPE_EXPANDO, key, value);
			}
			
			/**
			 * Make abbreviation from string
			 * @param {String} key Abbreviation key
			 * @param {String} tag_name Expanded element's tag name
			 * @param {String} attrs Expanded element's attributes
			 * @param {Boolean} is_empty Is expanded element empty or not
			 * @return {Object}
			 */
			function makeAbbreviation(key, tag_name, attrs, is_empty) {
				var result = {
					name: tag_name,
					is_empty: Boolean(is_empty)
				};
				
				if (attrs) {
					var m;
					result.attributes = [];
					while (m = re_attrs.exec(attrs)) {
						result.attributes.push({
							name: m[1],
							value: m[3]
						});
					}
				}
				
				return entry(TYPE_ABBREVIATION, key, result);
			}
			
			/**
			 * Parses all abbreviations inside object
			 * @param {Object} obj
			 */
			function parseAbbreviations(obj) {
				for (var key in obj) {
					var value = obj[key], m;
					
					key = trim(key);
					if (key.substr(-1) == '+') {
						// this is expando, leave 'value' as is
						obj[key] = makeExpando(key, value);
					} else if (m = re_tag.exec(value)) {
						obj[key] = makeAbbreviation(key, m[1], m[2], m[3] == '/');
					} else {
						// assume it's reference to another abbreviation
						obj[key] = entry(TYPE_REFERENCE, key, value);
					}
					
				}
			}
			
			return {
				/**
				 * Parse user's settings
				 * @param {Object} settings
				 */
				parse: function(settings) {
					for (var p in settings) {
						if (p == 'abbreviations')
							parseAbbreviations(settings[p]);
						else if (typeof(settings[p]) == 'object')
							arguments.callee(settings[p]);
					}
				},
				
				extend: function(parent, child) {
					for (var p in child) {
						if (typeof(child[p]) == 'object' && parent.hasOwnProperty(p))
							arguments.callee(parent[p], child[p]);
						else
							parent[p] = child[p];
					}
				},
				
				/**
				 * Create hash maps on certain string properties
				 * @param {Object} obj
				 */
				createMaps: function(obj) {
					for (var p in obj) {
						if (p == 'element_types') {
							for (var k in obj[p]) 
								obj[p][k] = stringToHash(obj[p][k]);
						} else if (typeof(obj[p]) == 'object') {
							arguments.callee(obj[p]);
						}
					}
				},
				
				TYPE_ABBREVIATION: TYPE_ABBREVIATION,
				TYPE_EXPANDO: TYPE_EXPANDO,
				
				/** Reference to another abbreviation or tag */
				TYPE_REFERENCE: TYPE_REFERENCE
			}
		})()
	}
	
})();