/**
 * All editors should extend from this class
 */
$.jsoneditor.AbstractEditor = Class.extend({
  fireChangeEvent: function() {
    $trigger(this.container,'change');
  },
  fireSetEvent: function() {
    $triggerc(this.container,'set');
  },
  fireChangeHeaderEvent: function() {
    $triggerc(this.container,'change_header_text');
  },
  init: function(options) {
    var self = this;
    this.container = options.container;
    this.jsoneditor = options.jsoneditor;
    
    //if(this.container.context) this.container = this.container.get(0);

    this.theme = this.jsoneditor.data('jsoneditor').theme;
    this.template_engine = this.jsoneditor.data('jsoneditor').template;
    this.iconlib = this.jsoneditor.data('jsoneditor').iconlib;

    this.options = $extend({}, (this.options || {}), (options.schema.options || {}), options);
    this.schema = this.options.schema;

    if(!options.path && !this.schema.id) this.schema.id = 'root';
    this.path = options.path || 'root';
    if(this.schema.id) this.container.setAttribute('data-schemaid',this.schema.id);
    if(this.schema.type && typeof this.schema.type === "string") this.container.setAttribute('data-schematype',this.schema.type);
    this.container.setAttribute('data-schemapath',this.path);
    $(this.container).data('editor',this);
    this.container.editor = this;

    this.key = this.path.split('.').pop();
    this.parent = options.parent;
    
    // If not required, add an add/remove property link
    if(!this.isRequired() && !this.options.compact) {
      this.title_links = this.container.appendChild(this.theme.getFloatRightLinkHolder());

      this.addremove = this.title_links.appendChild(this.theme.getLink('remove '+this.getTitle()));

      this.addremove.addEventListener('click',function() {
        if(self.property_removed) {
          self.addProperty();
        }
        else {
          self.removeProperty();
        }
      
        self.fireChangeEvent();
        return false;
      });
    }
    
    this.container.addEventListener('change',self.watch_listener);
    this.container.addEventListener('set',self.watch_listener);
    
    // Watched fields
    this.watched = {};
    if(this.schema.vars) this.schema.watch = this.schema.vars;
    this.watched_values = {};
    this.watch_listener_firing = false;
    this.watch_listener = function() {
      if(self.refreshWatchedFieldValues()) {
        self.onWatchedFieldChange();
      }
    };
    if(this.schema.watch) {
      $each(this.schema.watch, function(name, path) {
        var path_parts;
        if(path instanceof Array) {
          path_parts = [path[0]].concat(path[1].split('.'));
        }
        else {
          path_parts = path.split('.');
          if(!self.theme.closest(self.container,'[data-schemaid="'+path_parts[0]+'"]')) path_parts.unshift('#');
        }
        var first = path_parts.shift();

        if(first === '#') first = self.jsoneditor.data('jsoneditor').schema.id || 'root';

        // Find the root node for this template variable
        var root = self.theme.closest(self.container,'[data-schemaid="'+first+'"]');
        if(!root) throw "Could not find ancestor node with id "+first;

        // Keep track of the root node and path for use when rendering the template
        var adjusted_path = root.getAttribute('data-schemapath') + '.' + path_parts.join('.');
        self.watched[name] = {
          root: root,
          path: path_parts,
          editor: $(root).data('editor'),
          adjusted_path: adjusted_path
        };

        // Listen for changes to the variable field
        root.addEventListener('change',self.watch_listener);
        root.addEventListener('set',self.watch_listener);
      });
    }
    
    // Dynamic header
    if(this.schema.headerTemplate) {
      this.header_template = $.jsoneditor.compileTemplate(this.schema.headerTemplate, this.template_engine);
    }

    this.build();
    
    this.setValue(this.getDefault(), true);
    this.updateHeaderText();
    this.watch_listener();
  },
  getButton: function(text, icon, title) {
    if(!this.iconlib) icon = null;
    else icon = this.iconlib.getIcon(icon);
    
    if(!icon && title) {
      text = title;
      title = null;
    }
    
    return this.theme.getButton(text, icon, title);
  },
  setButtonText: function(button, text, icon, title) {
    if(!this.iconlib) icon = null;
    else icon = this.iconlib.getIcon(icon);
    
    if(!icon && title) {
      text = title;
      title = null;
    }
    
    return this.theme.setButtonText(button, text, icon, title);
  },
  refreshWatchedFieldValues: function() {
    if(!this.watched_values) return;
    var watched = {};
    var changed = false;
    var self = this;
    
    if(this.watched) {
      $each(this.watched,function(name,attr) {
        var obj = attr.editor.getValue();
        var current_part = -1;
        var val = null;
        // Use "path.to.property" to get root['path']['to']['property']
        while(1) {
          current_part++;
          if(current_part >= attr.path.length) {
            val = obj;
            break;
          }

          if(!obj || typeof obj[attr.path[current_part]] === "undefined") {
            break;
          }

          obj = obj[attr.path[current_part]];
        }
        if(self.watched_values[name] !== val) changed = true;
        watched[name] = val;
      });
    }
    
    watched.self = this.getValue();
    if(this.watched_values.self !== watched.self) changed = true;
    
    this.watched_values = watched;
    
    return changed;
  },
  getWatchedFieldValues: function() {
    return this.watched_values;
  },
  updateHeaderText: function() {
    if(this.header) {
      this.header.innerHTML = '';
      this.header.appendChild(document.createTextNode(this.getHeaderText()));
    }
  },
  getHeaderText: function(title_only) {
    if(this.header_text) return this.header_text;
    else if(title_only) return this.schema.title;
    else return this.getTitle();
  },
  onWatchedFieldChange: function() {
    if(this.header_template) {
      var vars = $extend(this.getWatchedFieldValues(),{
        key: this.key,
        i: this.key,
        title: this.getTitle()
      });
      var header_text = this.header_template(vars);
      
      if(header_text !== this.header_text) {
        this.header_text = header_text;
        this.updateHeaderText();
        this.fireChangeHeaderEvent();
      }
    }
  },
  addProperty: function() {
    this.property_removed = false;
    this.addremove.innerHTML = '';
    this.addremove.appendChild(document.createTextNode('remove '+this.getTitle()));
  },
  removeProperty: function() {
    this.property_removed = true;
    this.addremove.innerHTML = '';
    this.addremove.appendChild(document.createTextNode('add '+this.getTitle()));
  },
  build: function() {

  },
  isValid: function(callback) {
    callback();
  },
  setValue: function(value) {
    this.value = value;
  },
  getValue: function() {
    return this.value;
  },
  refreshValue: function() {

  },
  getChildEditors: function() {
    return false;
  },
  destroy: function() {
    var self = this;
    $each(this.watched,function(name,attr) {
      attr.root.removeEventListener('change',self.watch_listener);
      attr.root.removeEventListener('set',self.watch_listener);
    });
    this.watched = null;
    this.watched_values = null;
    this.watch_listener = null;
    this.header_text = null;
    this.header_template = null;
    this.value = null;
    if(this.container.parentNode) this.container.parentNode.removeChild(this.container);
    this.container = null;
    this.jsoneditor = null;
    this.schema = null;
    this.path = null;
    this.key = null;
    this.parent = null;
  },
  isRequired: function() {
    if(typeof this.options.required !== "undefined") {
      return this.options.required;
    }
    else if(typeof this.schema.required === "boolean") {
      return this.schema.required;
    }
    else if(this.jsoneditor.data('jsoneditor').options.required_by_default) {
      return true
    }
    else {
      return false;
    }
  },
  getDefault: function() {
    return this.schema.default || null;
  },

  getTheme: function() {
    return this.theme;
  },
  getSchema: function() {
    return this.schema;
  },
  getContainer: function() {
    return this.container;
  },
  getTitle: function() {
    return this.schema.title || this.key;
  },
  getPath: function() {
    return this.path;
  },
  getParent: function() {
    return this.parent;
  },
  getOption: function(key, def) {
    if(typeof this.options[key] !== 'undefined') return this.options[key];
    else return def;
  },
  getDisplayText: function(arr) {
    var disp = [];
    var used = {};
    
    // Determine how many times each attribute name is used.
    // This helps us pick the most distinct display text for the schemas.
    $each(arr,function(i,el) {
      if(el.title) {
        used[el.title] = used[el.title] || 0;
        used[el.title]++;
      }
      if(el.description) {
        used[el.description] = used[el.description] || 0;
        used[el.description]++;
      }
      if(el.format) {
        used[el.format] = used[el.format] || 0;
        used[el.format]++;
      }
      if(el.type) {
        used[el.type] = used[el.type] || 0;
        used[el.type]++;
      }
    });
    
    // Determine display text for each element of the array
    $each(arr,function(i,el)  {
      var name;
      
      // If it's a simple string
      if(typeof el === "string") name = el;
      // Object
      else if(el.title && used[el.title]<=1) name = el.title;
      else if(el.format && used[el.format]<=1) name = el.format;
      else if(el.type && used[el.type]<=1) name = el.type;
      else if(el.description && used[el.description]<=1) name = el.descripton;
      else if(el.title) name = el.title;
      else if(el.format) name = el.format;
      else if(el.type) name = el.type;
      else if(el.description) name = el.description;
      else if(JSON.stringify(el).length < 50) name = JSON.stringify(el);
      else name = "type";
      
      disp.push(name);
    });
    
    // Replace identical display text with "text 1", "text 2", etc.
    var inc = {};
    $each(disp,function(i,name) {
      inc[name] = inc[name] || 0;
      inc[name]++;
      
      if(used[name] > 1) disp[i] = name + " " + inc[name];
    });
    
    return disp;
  },
  showValidationErrors: function(errors) {

  }
});
