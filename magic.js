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

CompoundComponent.prototype.draw_divider = function compound_component_draw_divider(ctx, width, height, divider) {
    ctx.save();
    ctx.moveTo(divider.p1.x, divider.p1.y);
    ctx.lineTo(divider.p2.x, divider.p2.y)
    ctx.stroke();
    ctx.restore();
}

CompoundComponent.prototype.draw_subcomponent = function compound_component_draw_subcomponent(ctx, width, height, region, component) {
    ctx.save();
    ctx.translate(region.x, region.y);
    component.draw(ctx, region.width, region.width);
    ctx.restore();
}

CompoundComponent.prototype.draw = function compound_component_draw(ctx, width, height) {
    this.draw_border(ctx, width, height);

    var layout = this.compute_layout(width, height);
    var i;
    for (i = 0; i < layout.dividers.length; i++) {
        var divider = layout.dividers[i];
        this.draw_divider(ctx, width, height, divider);
    }

    for (i = 0; i < layout.regions.length; i++) {
        var region = layout.regions[i];
        var component = this.components[i];
        this.draw_subcomponent(ctx, width, height, region, component);
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

function TriangularComponent(components, rotation_angle) {
    this.rotation_angle = rotation_angle;
    CompoundComponent.call(this, components);
}

TriangularComponent.prototype = Object.create(CompoundComponent.prototype);
TriangularComponent.prototype.constructor = TriangularComponent;

TriangularComponent.prototype.transform = function triangular_component_transform(ctx, width, height) {
    ctx.translate(width / 2, height / 2);
    ctx.rotate(this.rotation_angle);
    ctx.translate(-width / 2, -height / 2);
}

TriangularComponent.prototype.draw_border = function triangular_component_draw_border(ctx, width, height) {
    ctx.save();
    this.transform(ctx, width, height);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(width / 2, height);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
}

TriangularComponent.prototype.draw_divider = function triangular_component_draw_divider(ctx, width, height, divider) {
    ctx.save();
    this.transform(ctx, width, height);
    CompoundComponent.prototype.draw_divider.call(this, ctx, width, height, divider);
    ctx.restore();
}

TriangularComponent.prototype.draw_subcomponent = function triangular_component_draw_subcomponent(ctx, width, height, region, component) {
    ctx.save();
    this.transform(ctx, width, height);
    ctx.translate(region.x, region.y);

    // Un-rotate the the sub-component
    ctx.translate(region.width / 2, region.width / 2);
    ctx.rotate(-this.rotation_angle);
    ctx.translate(-region.width / 2, -region.width / 2);

    component.draw(ctx, region.width, region.width);
    ctx.restore();
}

TriangularComponent.prototype.compute_layout = function triangular_component_compute_layout(width, height) {
    var dividers = [];
    var regions = [];

    if (this.components.length == 1) {
        var max_width = width * (1 - Math.sqrt(3)/(Math.sqrt(3) + 2));
        regions.push({x: width * Math.sqrt(3) / (2 * Math.sqrt(3) + 4) + 0.1 * max_width,
                      y: 0.1 * max_width,
                      width: max_width * 0.8});
    } else if (this.components.length == 2) {
        dividers.push({p1: {x: width / 2, y: 0}, p2: {x: width / 2, y: height}});

        var max_width = width / 2 - (width * width) / (2 * width + 4 * height);
        regions.push({x: width / 2 - max_width * 0.9,
                      y: max_width * 0.1,
                      width: max_width * 0.8});
        regions.push({x: width / 2 + max_width * 0.1,
                      y: max_width * 0.1,
                      width: max_width * 0.8});
    } else {
        throw new Error("TriangularComponents currently only support up to 2 components");
    }

    return {dividers: dividers, regions: regions};
}

function Target(components) {
    TriangularComponent.call(this, components, 0);
}
Target.prototype = Object.create(TriangularComponent.prototype);
Target.prototype.constructor = Target;

function Duration(components) {
    TriangularComponent.call(this, components, Math.PI);
}
Duration.prototype = Object.create(TriangularComponent.prototype);
Duration.prototype.constructor = Duration;

function Restriction(components) {
    TriangularComponent.call(this, components, -Math.PI / 2);
}
Restriction.prototype = Object.create(TriangularComponent.prototype);
Restriction.prototype.constructor = Restriction;

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

function make_compound_component_parser(component_name, constructor, start_delim, end_delim, parse_prefix) {
    function parse_component(str, start) {
        if (str[start] != start_delim) {
            throw new Error("Not a " + component_name);
        }
        var pos = start + 1;
        var ret;
        var components = []
        var prefix;

        if (parse_prefix) {
            var regex = /(\w+):/g;
            regex.lastIndex = pos;
            prefix = regex.exec(str)[1];
            if (prefix === undefined) {
               throw new Error("Prefixed component has no prefix");
            }
            pos += prefix.length + 1;
        }

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
                ret = parse_triangular_component(str, pos);
                components.push(ret.tree);
                pos += ret.consumed;
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
                tree: new constructor(components),
                prefix: prefix};
    }
    return parse_component;
}

var parse_generic_triangular_component = make_compound_component_parser("triangular component", Object, '<', '>', true);
function parse_triangular_component(str, start) {
    var ret = parse_generic_triangular_component(str, start);
    var ctors = {T: Target, D: Duration, R: Restriction};
    if (! ctors.hasOwnProperty(ret.prefix)) {
        throw new Error("Bad triangular component type: " + ret.prefix);
    }

    ret.tree = new ctors[ret.prefix](ret.tree);
    return ret;
}

var parse_spell = make_compound_component_parser("spell", Spell, '(', ')', false);
var parse_unit = make_compound_component_parser("unit", Unit, '[', ']', false);

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
