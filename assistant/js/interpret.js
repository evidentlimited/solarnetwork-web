class Interpret {
  constructor(input) {
    this.input = input;
  }

  get intent() {
    var possible = [];
    this.input = this.input.replace(/[^\w\s]/gi, '');
    var intents = this.intents;
    for(var i in intents) {
      var possibleSequences = [];
      for(var s in intents[i].sequences) {
        var entities = this.checkSequence(intents[i].sequences[s]);
        if(entities != null) {
          possible.push({ action: intents[i].action, entities: entities });
        }
      }
    }
    if(possible.length == 0) {
      return null;
    }
    var best = 0;
    var length = 0;
    for (var p = 0; p < possible.length; p++) {
      if(possible[p].entities.length > length) {
        length = possible[p].entities.length;
        best = p;
      }
    }
    return possible[best];
  }

  checkSequence(sequence) {
    var entities = this.entities;
    var sequenceEntities = [];
    for(var s in sequence) {// each sequence value
      if(entities[sequence[s]]) {
        var entity = this.checkEntity(entities[sequence[s]]);
        if(entity == null) {
          return null;
        }
        entity.entity = sequence[s];
        sequenceEntities.push(entity);
      }

    }
    var lastIndex = 0;
    for(var s in sequenceEntities) {
      if(sequenceEntities[s].index <= lastIndex) {
        return null;
      }
      lastIndex = sequenceEntities[s].index;
    }
    return sequenceEntities;
  }

  checkEntity(entities) {
    for(var e in entities) {// each entity
      for(var t in entities[e]) {// each term
        var term = this.checkTerm(entities[e][t]);
        if(term != null) {
          return { value: entities[e][0], term: entities[e][t], index: term };
        }
      }
    }
    return null;
  }

  checkTerm(term) {
    var index = this.input.indexOf(term);
    if(index != -1) {
      var substring = this.input.substring(index);
      var spaceIndex = substring.indexOf(' ', term.length);
      var selected = spaceIndex == -1 ? substring : substring.substring(0, spaceIndex);
      var possible = [selected, selected + 's', selected + '\'s'];
      if(possible.indexOf(term) != -1) {
        return index;
      }
    }
    return null;
  }

  get intents() {
    return [
      {
        action: 'data.current',
        sequences: [
          ['datapoint'],
          ['datapoint','location'],
          ['location','datapoint']
        ]
      },
      {
        action: 'data.query',
        sequences: [
          ['time','datapoint'],
          ['datapoint','time'],
          ['datapoint','time','location'],
          ['datapoint','location','time'],
          ['location','datapoint','time'],
          ['location','time','datapoint'],
          ['time','location','datapoint'],
          ['time','datapoint','location']
        ]
      }
    ]
  }

  get entities() {
    return {
      datapoint: [
        ['temperature','heat','hot','cold'],
        ['humidity','humid'],
        ['co2']
      ],
      location: [
        ['lounge','living room'],
        ['bathroom','shower'],
        ['kitchen'],
        ['laundry'],
        ['outside','outdoors']
      ],
      time: [
        ['today','this day','past day'],
        ['yesterday','last day'],
        ['this week','past week'],
        ['last week'],
        ['this month','past month'],
        ['last month'],
        ['this year','past year'],
        ['last year']
      ]
    }
  }
}
