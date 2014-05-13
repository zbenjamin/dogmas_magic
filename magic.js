function Rune(name) {
    this.name = name;
    this.complexity = 0;
    return this;
}

Rune.prototype.draw = function rune_draw(ctx, width, height) {
    var filename = "runes/" + this.name + ".svg";
    var svg;
    try {
        svg = get_svg(filename);
    } catch (e) {
        throw new Error("Cannot get SVG data for rune: " + this.name + ": " + e.message);
    }
    canvg.ViewPort.Clear();
    canvg.ViewPort.SetCurrent(width, height);
    svg.render(ctx);
}

function max_component_complexity(components) {
    return _.pluck(components, 'complexity').reduce(Math.max);
}

function CompoundComponent(components) {
    this.components = components;
    this.complexity = Math.max(max_component_complexity(components) + 1,
                               Math.log(components.length - 1) / Math.log(2));
}

CompoundComponent.prototype.draw = function compound_component_draw(ctx, width, height) {
    this.draw_border(ctx, width, height);

    var layout = this.compute_layout(width, height);
    var i;
    for (i = 0; i < layout.dividers.length; i++) {
        var divider = layout.dividers[i];
        ctx.moveTo(divider.p1.x, divider.p1.y);
        ctx.lineTo(divider.p2.x, divider.p2.y)
        ctx.stroke();
    }

    for (i = 0; i < layout.regions.length; i++) {
        var region = layout.regions[i];
        ctx.save();
        ctx.translate(region.x, region.y);
        this.components[i].draw(ctx, region.width, region.width);
        ctx.restore();
    }
}

function Spell(components) {
    CompoundComponent.call(this, components)
}

Spell.prototype = Object.create(CompoundComponent.prototype);
Spell.prototype.constructor = Spell;

Spell.prototype.draw = function spell_draw(ctx, width, height) {
    ctx.save();
    // for spells, it's a little easier to do things with the origin at the center
    ctx.translate(width / 2, height / 2);
    CompoundComponent.prototype.draw.call(this, ctx, width, height);
    ctx.restore();
}

Spell.prototype.draw_border = function spell_draw_border(ctx, width, height) {
    ctx.beginPath();
    ctx.arc(0, 0, width / 2, 0, Math.PI*2);
    ctx.stroke();
}

Spell.prototype.compute_layout = function spell_compute_layout(width, height) {
    var radius = width / 2;
    var dividers = []
    var regions = [];

    if (this.components.length == 1) {
        var max_width = Math.cos(Math.PI/4) * radius * 2;
        regions.push({x: -1 * (max_width / 2 - max_width * 0.1),
                      y: -1 * (max_width / 2 - max_width * 0.1),
                      width: max_width * 0.8});
    } else if (this.components.length == 2) {
        dividers.push({p1: {x: Math.cos(Math.PI/4) * radius,
                            y: -1 * Math.sin(Math.PI/4) * radius},
                       p2: {x: -1 * Math.cos(Math.PI/4) * radius,
                            y: Math.sin(Math.PI/4) * radius}});

        var max_width = Math.cos(Math.PI/4) * radius;
        regions.push({x: -1 * (max_width - max_width * 0.1),
                      y: -1 * (max_width - max_width * 0.1),
                      width:  max_width * 0.8});
        regions.push({x:      max_width * 0.1,
                      y:      max_width * 0.1,
                      width:  max_width * 0.8});
    } else {
        throw new Error("Spells currently only support up to 2 components");
    }

    return {dividers: dividers, regions: regions};
}

function Unit(components) {
    CompoundComponent.call(this, components)
}

Unit.prototype = Object.create(CompoundComponent.prototype);
Unit.prototype.constructor = Unit;

Unit.prototype.draw_border = function unit_draw_border(ctx, width, height) {
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.stroke();
}

Unit.prototype.compute_layout = function unit_compute_layout(width, height) {
    var dividers = [];
    var regions = [];

    if (this.components.length == 1) {
        regions.push({x: width * 0.1, y: height * 0.1, width: width * 0.8});
    } else if (this.components.length == 2) {
        dividers.push({p1: {x: 0, y: height}, p2: {x: width, y: 0}});

        regions.push({x: width / 2 * 0.1, y: height / 2 * 0.1, width: width / 2 * 0.8});
        regions.push({x: width / 2 * 1.1, y: height / 2 * 1.1, width: width / 2 * 0.8});
    } else {
        throw new Error("Units currently only support up to 2 components");
    }

    return {dividers: dividers, regions: regions};
}

function parse_magic(str) {
    var pos = 0;
    var ret;

    while (pos < str.length) {
        var c = str[pos];
        if (_.contains(' \n\t', c)) {
            pos++;
        } else if (c == '(') {
            ret = parse_spell(str, pos);
            pos += ret.consumed;
         } else {
             throw new Error("Malformed spell description");
        }
    }
    if (ret === undefined) {
        throw new Error("No spell description");
    }
    return ret.tree;
}

function make_compound_component_parser(component_name, constructor, start_delim, end_delim) {
    function parse_component(str, start) {
        if (str[start] != start_delim) {
            throw new Error("Not a " + component_name);
        }
        var pos = start + 1;
        var ret;
        var components = []

        while (pos < str.length) {
            var c = str[pos];
            if (_.contains(' \n\t/', c)) {
                pos++;
            } else if (/\w/.test(c)) {
                var regex = /\w+/g;
                regex.lastIndex = pos;
                var rune_name = regex.exec(str)[0];
                components.push(new Rune(rune_name))
                pos += rune_name.length
            } else if (c == '(') {
                ret = parse_spell(str, pos);
                components.push(ret.tree);
                pos += ret.consumed;
            } else if (c == '[') {
                ret = parse_unit(str, pos);
                components.push(ret.tree);
                pos += ret.consumed;
            } else if (c == '<') {
                throw new Error("Targets, durations, and restrictions are not yet supported");
            } else if (c == '{') {
                throw new Error("Definitions are not yet supported");
            } else if (_.contains(')]}>', c)) {
                if (c !== end_delim) {
                    throw new Error("Bad closing delimeter for " + component_name);
                }
                pos++;
                break;
            } else {
                throw new Error("Bad character in " + component_name);
            }
        }

        return {consumed: pos - start,
                tree: new constructor(components)};
    }
    return parse_component;
}

var parse_spell = make_compound_component_parser("spell", Spell, '(', ')');
var parse_unit = make_compound_component_parser("unit", Unit, '[', ']');

var svg_cache = {};
function get_svg(url) {
    if (! svg_cache.hasOwnProperty(url)) {
        var xml;
        var error_status;
        $.ajax({url: url,
                async: false,
                isLocal: true,
                success: function (data, result, xhr) {
                    xml = xhr.responseText;
                },
                error: function (xhr) {
                    // We can't throw an error from here.  See
                    // http://bugs.jquery.com/ticket/7201
                    error_status = xhr.status;
                }
               });
        if (error_status !== undefined) {
            throw new Error("GET failed with error code " + error_status);
        }
        var svg = canvg.parseXml(xml);
        var elem = canvg.CreateElement(svg.documentElement);
        elem.root = true;

        var width = elem.attribute('width').toPixels('x');
        var height = elem.attribute('height').toPixels('y');
        elem.attribute('viewBox', true).value = '0 0 ' + width + ' ' + height;

        svg_cache[url] = elem;
    }

    return svg_cache[url];
}

$(function() {
    var canvas = $("#spell_canvas")[0];
    var ctx = canvas.getContext("2d");
    canvg.init(ctx);

    $("form").submit(function (e) {
        e.preventDefault();
        try {
            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            var txt = $("#spell_desc").val();
            var spell;
            spell = parse_magic(txt);

            $("#error_msg").text('');
            spell.draw(ctx, canvas.width, canvas.height);
        } catch (e) {
            $("#error_msg").text(e.message);
        } finally {
            ctx.restore();
        }
    });
});
