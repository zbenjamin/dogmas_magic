function Rune(name) {
    this.name = name;
    this.complexity = 0;
    return this;
}

Rune.prototype = {
    draw: function rune_draw(ctx, width, height) {
        ctx.fillRect(0, 0, width, height);
    }
};

function max_component_complexity(components) {
    return components.map(function(c) {return c.complexity;}).reduce(Math.max);
}

function Spell(components) {
    this.components = components;
    this.complexity = Math.max(max_component_complexity(components) + 1,
                               Math.log(components.length - 1) / Math.log(2));
    return this;
}

Spell.prototype = {
    draw: function spell_draw(ctx, width, height) {
        var radius = width / 2;
        var i;
        ctx.translate(width / 2, height / 2);

        // outer circle
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI*2);
        ctx.stroke();

        var layout = this.compute_layout(radius);
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
    },

    compute_layout: function spell_compute_layout(radius) {
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
        }

        return {dividers: dividers, regions: regions};
    }    
};

$(function() {
    var c = $("#spell_canvas")[0];
    var ctx = c.getContext("2d");
    var s = new Spell([new Rune("foo"), new Rune("bar")]);
    // var s = new Spell([new Rune("foo")]);
    s.draw(ctx, 500, 500);
});
