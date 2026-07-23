import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  FlatList,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle } from 'react-native-svg';
import { Image } from 'expo-image';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface EmojiItem {
  char: string;
  name: string;
  keywords: string[];
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: EmojiItem[];
}

const STORAGE_KEY = '@astro:recent_emojis';
const NUM_COLUMNS = 8;
const EMOJI_SIZE = Math.floor((SCREEN_WIDTH - 24) / NUM_COLUMNS);

// Comprehensive catalog of standard emojis with keywords for search
const EMOJI_DATA: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'Smileys & People',
    icon: '😀',
    emojis: [
      { char: '😀', name: 'grinning face', keywords: ['smile', 'happy', 'face', 'grin', 'joy'] },
      { char: '😃', name: 'grinning face with big eyes', keywords: ['smile', 'happy', 'face', 'joy', 'haha'] },
      { char: '😄', name: 'grinning face with smiling eyes', keywords: ['smile', 'happy', 'face', 'joy', 'laugh'] },
      { char: '😁', name: 'beaming face with smiling eyes', keywords: ['smile', 'happy', 'face', 'grin'] },
      { char: '😆', name: 'grinning squinting face', keywords: ['laugh', 'face', 'squint', 'haha', 'happy'] },
      { char: '😅', name: 'grinning face with sweat', keywords: ['sweat', 'laugh', 'face', 'happy', 'nervous'] },
      { char: '😂', name: 'face with tears of joy', keywords: ['laugh', 'tears', 'joy', 'face', 'haha', 'lol'] },
      { char: '🤣', name: 'rolling on the floor laughing', keywords: ['laugh', 'roll', 'floor', 'face', 'rofl', 'lol'] },
      { char: '🥲', name: 'smiling face with tear', keywords: ['smile', 'tear', 'sad', 'happy', 'grateful'] },
      { char: '😊', name: 'smiling face with smiling eyes', keywords: ['smile', 'blush', 'face', 'happy', 'friendly'] },
      { char: '😇', name: 'smiling face with halo', keywords: ['halo', 'angel', 'innocent', 'good', 'face'] },
      { char: '🙂', name: 'slightly smiling face', keywords: ['smile', 'face', 'ok'] },
      { char: '🙃', name: 'upside-down face', keywords: ['upside', 'down', 'face', 'silly', 'sarcasm'] },
      { char: '😉', name: 'winking face', keywords: ['wink', 'face', 'flirt', 'secret'] },
      { char: '😌', name: 'relieved face', keywords: ['relieved', 'calm', 'peace', 'satisfied', 'face'] },
      { char: '😍', name: 'smiling face with heart-eyes', keywords: ['heart', 'love', 'face', 'like', 'adore'] },
      { char: '🥰', name: 'smiling face with hearts', keywords: ['love', 'hearts', 'blush', 'warm', 'face'] },
      { char: '😘', name: 'face blowing a kiss', keywords: ['kiss', 'blow', 'love', 'flirt', 'face'] },
      { char: '😋', name: 'face savoring food', keywords: ['yum', 'tongue', 'delicious', 'yummy', 'hungry'] },
      { char: '😛', name: 'face with tongue', keywords: ['tongue', 'silly', 'playful', 'face'] },
      { char: '😜', name: 'winking face with tongue', keywords: ['tongue', 'wink', 'silly', 'playful', 'face'] },
      { char: '🤪', name: 'zany face', keywords: ['crazy', 'silly', 'zany', 'wild', 'face'] },
      { char: '😝', name: 'squinting face with tongue', keywords: ['tongue', 'squint', 'silly', 'playful', 'face'] },
      { char: '🤗', name: 'hugging face', keywords: ['hug', 'cuddle', 'friendly', 'face'] },
      { char: '🤭', name: 'face with hand over mouth', keywords: ['gasp', 'giggle', 'laugh', 'oops'] },
      { char: '🫣', name: 'face with peeking eye', keywords: ['peek', 'scared', 'hide', 'look'] },
      { char: '🤫', name: 'shushing face', keywords: ['shush', 'quiet', 'silent', 'whisper'] },
      { char: '🤔', name: 'thinking face', keywords: ['think', 'wonder', 'hmm', 'question', 'face'] },
      { char: '🤐', name: 'zipper-mouth face', keywords: ['zipper', 'mouth', 'silent', 'secret'] },
      { char: '🤨', name: 'face with raised eyebrow', keywords: ['eyebrow', 'skeptical', 'really', 'face'] },
      { char: '😐', name: 'neutral face', keywords: ['neutral', 'indifferent', 'meh', 'face'] },
      { char: '😑', name: 'expressionless face', keywords: ['expressionless', 'meh', 'flat', 'face'] },
      { char: '😬', name: 'grimacing face', keywords: ['grimace', 'awkward', 'teeth', 'face'] },
      { char: '🫨', name: 'shaking face', keywords: ['shake', 'shock', 'dizzy', 'vibrate'] },
      { char: '🫠', name: 'melting face', keywords: ['melt', 'hot', 'warm', 'sarcasm'] },
      { char: '🤥', name: 'lying face', keywords: ['lie', 'liar', 'pinocchio', 'nose'] },
      { char: '😴', name: 'sleeping face', keywords: ['sleep', 'zzz', 'tired', 'night', 'face'] },
      { char: '🤤', name: 'drooling face', keywords: ['drool', 'desire', 'sleep', 'face'] },
      { char: '😪', name: 'sleepy face', keywords: ['sleepy', 'tired', 'bubble', 'face'] },
      { char: '😵', name: 'dizzy face', keywords: ['dizzy', 'dead', 'shock', 'face'] },
      { char: '😵‍💫', name: 'face with spiral eyes', keywords: ['dizzy', 'spiral', 'confused', 'hypnotized'] },
      { char: '🤢', name: 'nauseated face', keywords: ['sick', 'green', 'nausea', 'vomit', 'gross'] },
      { char: '🤮', name: 'face vomiting', keywords: ['vomit', 'puke', 'sick', 'throwup'] },
      { char: '🤧', name: 'sneezing face', keywords: ['sneeze', 'sick', 'cold', 'flu'] },
      { char: '🥵', name: 'hot face', keywords: ['hot', 'red', 'sunburn', 'sweat', 'summer'] },
      { char: '🥶', name: 'cold face', keywords: ['cold', 'blue', 'ice', 'freeze', 'winter'] },
      { char: '🥴', name: 'woozy face', keywords: ['woozy', 'dizzy', 'drunk', 'tired'] },
      { char: '🤯', name: 'exploding head', keywords: ['mind', 'blown', 'explode', 'shock', 'wow'] },
      { char: '🤠', name: 'cowboy hat face', keywords: ['cowboy', 'hat', 'sheriff', 'west'] },
      { char: '🥳', name: 'partying face', keywords: ['party', 'celebrate', 'hat', 'horn', 'fun'] },
      { char: '🥸', name: 'disguised face', keywords: ['disguise', 'glasses', 'mustache', 'mask'] },
      { char: '😎', name: 'smiling face with sunglasses', keywords: ['cool', 'sun', 'sunglasses', 'chill'] },
      { char: '🤓', name: 'nerd face', keywords: ['nerd', 'geek', 'glasses', 'smart'] },
      { char: '🧐', name: 'face with monocle', keywords: ['monocle', 'inspect', 'fancy', 'smart'] },
      { char: '😕', name: 'confused face', keywords: ['confused', 'unsure', 'huh', 'face'] },
      { char: '😟', name: 'worried face', keywords: ['worried', 'nervous', 'scared', 'face'] },
      { char: '🙁', name: 'slightly frowning face', keywords: ['frown', 'sad', 'face'] },
      { char: '☹️', name: 'frowning face', keywords: ['frown', 'sad', 'upset', 'face'] },
      { char: '😮', name: 'face with open mouth', keywords: ['open', 'mouth', 'surprise', 'gasp'] },
      { char: '😯', name: 'hushed face', keywords: ['hushed', 'surprise', 'quiet', 'face'] },
      { char: '😲', name: 'astonished face', keywords: ['astonished', 'shock', 'gasp', 'wow'] },
      { char: '😳', name: 'flushed face', keywords: ['flushed', 'blush', 'shame', 'embarrassed'] },
      { char: '🥺', name: 'pleading face', keywords: ['plead', 'beg', 'eyes', 'cute', 'sad'] },
      { char: '😢', name: 'crying face', keywords: ['cry', 'tear', 'sad', 'upset'] },
      { char: '😭', name: 'loudly crying face', keywords: ['cry', 'sob', 'tears', 'sad', 'upset', 'screaming'] },
      { char: '😤', name: 'face with steam from nose', keywords: ['steam', 'angry', 'mad', 'triumph', 'frustrated'] },
      { char: '😠', name: 'angry face', keywords: ['angry', 'mad', 'annoyed', 'face'] },
      { char: '😡', name: 'enraged face', keywords: ['angry', 'mad', 'red', 'pissed', 'enraged'] },
      { char: '🤬', name: 'face with symbols on mouth', keywords: ['swear', 'cuss', 'angry', 'mad', 'curse'] },
      { char: '😈', name: 'smiling face with horns', keywords: ['devil', 'horns', 'evil', 'mischievous'] },
      { char: '👿', name: 'angry face with horns', keywords: ['devil', 'horns', 'evil', 'angry'] },
      { char: '💀', name: 'skull', keywords: ['skull', 'dead', 'skeleton', 'death', 'funny'] },
      { char: 'Poop', name: 'pile of poo', keywords: ['poop', 'poo', 'turd', 'shit', 'brown'] },
      { char: '🤡', name: 'clown face', keywords: ['clown', 'circus', 'funny', 'face'] },
      { char: '👹', name: 'ogre', keywords: ['ogre', 'monster', 'red', 'scary'] },
      { char: '👺', name: 'goblin', keywords: ['goblin', 'monster', 'red', 'scary'] },
      { char: '👻', name: 'ghost', keywords: ['ghost', 'spooky', 'halloween', 'scary'] },
      { char: '👽', name: 'alien', keywords: ['alien', 'ufo', 'space', 'martian'] },
      { char: '👾', name: 'alien monster', keywords: ['game', 'arcade', 'monster', 'retro'] },
      { char: '🤖', name: 'robot', keywords: ['robot', 'bot', 'tech', 'science'] },
      { char: '👋', name: 'waving hand', keywords: ['wave', 'hand', 'hello', 'bye', 'hi'] },
      { char: '🤚', name: 'raised back of hand', keywords: ['raised', 'hand', 'back'] },
      { char: '🖐️', name: 'hand with fingers splayed', keywords: ['hand', 'spread', 'five'] },
      { char: '✋', name: 'raised hand', keywords: ['hand', 'stop', 'highfive'] },
      { char: '🖖', name: 'vulcan salute', keywords: ['spock', 'vulcan', 'salute', 'star', 'trek'] },
      { char: '👌', name: 'OK hand', keywords: ['ok', 'okay', 'good', 'hand', 'perfect'] },
      { char: '🤌', name: 'pinched fingers', keywords: ['pinched', 'finger', 'italian', 'gesture'] },
      { char: '🤏', name: 'pinching hand', keywords: ['pinch', 'small', 'little', 'hand'] },
      { char: '✌️', name: 'victory hand', keywords: ['peace', 'victory', 'two', 'hand'] },
      { char: '🤞', name: 'crossed fingers', keywords: ['luck', 'crossed', 'fingers', 'hope'] },
      { char: '🫰', name: 'hand with index finger and thumb crossed', keywords: ['heart', 'love', 'snap', 'money', 'kpop'] },
      { char: '🤟', name: 'love-you gesture', keywords: ['love', 'gesture', 'hand'] },
      { char: '🤘', name: 'sign of the horns', keywords: ['rock', 'horns', 'metal', 'hand'] },
      { char: '🤙', name: 'call me hand', keywords: ['call', 'phone', 'hand', 'shaka'] },
      { char: '👈', name: 'backhand index pointing left', keywords: ['point', 'left', 'hand'] },
      { char: '👉', name: 'backhand index pointing right', keywords: ['point', 'right', 'hand'] },
      { char: '👆', name: 'backhand index pointing up', keywords: ['point', 'up', 'hand'] },
      { char: '🖕', name: 'middle finger', keywords: ['middle', 'finger', 'rude', 'flip'] },
      { char: '👇', name: 'backhand index pointing down', keywords: ['point', 'down', 'hand'] },
      { char: '☝️', name: 'index pointing up', keywords: ['point', 'up', 'one', 'hand'] },
      { char: '👍', name: 'thumbs up', keywords: ['thumbs', 'up', 'like', 'good', 'agree', 'yes'] },
      { char: '👎', name: 'thumbs down', keywords: ['thumbs', 'down', 'dislike', 'bad', 'no'] },
      { char: '✊', name: 'raised fist', keywords: ['fist', 'power', 'solidarity'] },
      { char: '👊', name: 'oncoming fist', keywords: ['fist', 'punch', 'brofist'] },
      { char: '🤛', name: 'left-facing fist', keywords: ['fist', 'left'] },
      { char: '🤜', name: 'right-facing fist', keywords: ['fist', 'right'] },
      { char: '👏', name: 'clapping hands', keywords: ['clap', 'hands', 'applause', 'bravo'] },
      { char: '🙌', name: 'raising hands', keywords: ['raise', 'hands', 'celebrate', 'hooray', 'yay'] },
      { char: '👐', name: 'open hands', keywords: ['open', 'hands', 'hug'] },
      { char: '🫶', name: 'heart hands', keywords: ['heart', 'hands', 'love', 'adore'] },
      { char: '🤝', name: 'handshake', keywords: ['handshake', 'deal', 'agreement', 'meet'] },
      { char: '🙏', name: 'folded hands', keywords: ['pray', 'please', 'thanks', 'thankyou', 'hope'] },
      { char: '✍️', name: 'writing hand', keywords: ['write', 'hand', 'pen', 'pencil'] },
      { char: '💅', name: 'nail polish', keywords: ['nail', 'polish', 'manicure', 'beauty', 'sass'] },
      { char: '💪', name: 'flexed biceps', keywords: ['muscle', 'strong', 'flex', 'biceps', 'power'] },
      { char: '🦾', name: 'mechanical arm', keywords: ['robotic', 'arm', 'mechanical', 'cybernetic'] },
      { char: '🦿', name: 'mechanical leg', keywords: ['robotic', 'leg', 'mechanical', 'cybernetic'] },
      { char: '🦵', name: 'leg', keywords: ['leg', 'limb'] },
      { char: '🦶', name: 'foot', keywords: ['foot', 'toe'] },
      { char: '👂', name: 'ear', keywords: ['ear', 'hear', 'listen'] },
      { char: '🦻', name: 'ear with hearing aid', keywords: ['hearing', 'aid', 'deaf'] },
      { char: '👃', name: 'nose', keywords: ['nose', 'smell', 'sniff'] },
      { char: '🧠', name: 'brain', keywords: ['brain', 'mind', 'smart', 'intelligence'] },
      { char: '🫀', name: 'anatomical heart', keywords: ['heart', 'organ', 'cardio'] },
      { char: '🫁', name: 'lungs', keywords: ['lungs', 'breathe', 'organ'] },
      { char: '🦷', name: 'tooth', keywords: ['tooth', 'teeth', 'dentist'] },
      { char: '🦴', name: 'bone', keywords: ['bone', 'skeleton'] },
      { char: '👀', name: 'eyes', keywords: ['eyes', 'look', 'see', 'watch'] },
      { char: '👁️', name: 'eye', keywords: ['eye', 'look', 'see'] },
      { char: '👅', name: 'tongue', keywords: ['tongue', 'mouth', 'taste'] },
      { char: '👄', name: 'mouth', keywords: ['mouth', 'lips', 'speak'] },
      { char: '💋', name: 'kiss mark', keywords: ['kiss', 'lips', 'love', 'red'] },
      { char: '👶', name: 'baby', keywords: ['baby', 'child', 'infant', 'cute'] },
      { char: '👧', name: 'girl', keywords: ['girl', 'child', 'female'] },
      { char: '🧒', name: 'child', keywords: ['child', 'kid', 'young'] },
      { char: '👦', name: 'boy', keywords: ['boy', 'child', 'male'] },
      { char: '👩', name: 'woman', keywords: ['woman', 'female', 'adult'] },
      { char: '🧑', name: 'person', keywords: ['person', 'human', 'adult'] },
      { char: '👨', name: 'man', keywords: ['man', 'male', 'adult'] },
      { char: '👵', name: 'old woman', keywords: ['grandma', 'grandmother', 'old', 'senior'] },
      { char: '👴', name: 'old man', keywords: ['grandpa', 'grandfather', 'old', 'senior'] },
    ],
  },
  {
    id: 'animals',
    name: 'Animals & Nature',
    icon: '🦋',
    emojis: [
      { char: '🐶', name: 'dog face', keywords: ['dog', 'puppy', 'pet', 'animal', 'bark'] },
      { char: '🐱', name: 'cat face', keywords: ['cat', 'kitten', 'pet', 'animal', 'meow'] },
      { char: '🐭', name: 'mouse face', keywords: ['mouse', 'rodent', 'animal'] },
      { char: '🐹', name: 'hamster face', keywords: ['hamster', 'rodent', 'pet', 'animal'] },
      { char: '🐰', name: 'rabbit face', keywords: ['rabbit', 'bunny', 'pet', 'animal'] },
      { char: '🦊', name: 'fox face', keywords: ['fox', 'animal', 'wild'] },
      { char: '🐻', name: 'bear face', keywords: ['bear', 'animal', 'wild'] },
      { char: '🐼', name: 'panda face', keywords: ['panda', 'animal', 'china'] },
      { char: '🐨', name: 'koala', keywords: ['koala', 'animal', 'australia'] },
      { char: '🐯', name: 'tiger face', keywords: ['tiger', 'cat', 'wild', 'animal'] },
      { char: '🦁', name: 'lion face', keywords: ['lion', 'cat', 'wild', 'animal', 'king'] },
      { char: '🐮', name: 'cow face', keywords: ['cow', 'farm', 'animal'] },
      { char: '🐷', name: 'pig face', keywords: ['pig', 'farm', 'animal'] },
      { char: '🐽', name: 'pig nose', keywords: ['pig', 'snout', 'nose'] },
      { char: '🐸', name: 'frog face', keywords: ['frog', 'amphibian', 'animal'] },
      { char: '🐵', name: 'monkey face', keywords: ['monkey', 'chimp', 'animal'] },
      { char: '🙈', name: 'see-no-evil monkey', keywords: ['monkey', 'blind', 'hide'] },
      { char: '🙉', name: 'hear-no-evil monkey', keywords: ['monkey', 'deaf', 'quiet'] },
      { char: '🙊', name: 'speak-no-evil monkey', keywords: ['monkey', 'mute', 'silent'] },
      { char: '🐒', name: 'monkey', keywords: ['monkey', 'animal'] },
      { char: '🐔', name: 'chicken', keywords: ['chicken', 'bird', 'farm'] },
      { char: '🐧', name: 'penguin', keywords: ['penguin', 'bird', 'cold'] },
      { char: '🐤', name: 'baby chick', keywords: ['chick', 'bird', 'baby', 'yellow'] },
      { char: '🦅', name: 'eagle', keywords: ['eagle', 'bird', 'predator', 'fly'] },
      { char: '🦆', name: 'duck', keywords: ['duck', 'bird', 'water'] },
      { char: '🦉', name: 'owl', keywords: ['owl', 'bird', 'night', 'wise'] },
      { char: '領', name: 'bat', keywords: ['bat', 'vampire', 'halloween', 'mammal'] },
      { char: '🐺', name: 'wolf face', keywords: ['wolf', 'dog', 'wild', 'animal'] },
      { char: '🐗', name: 'boar', keywords: ['boar', 'pig', 'wild'] },
      { char: '🐴', name: 'horse face', keywords: ['horse', 'farm', 'animal'] },
      { char: '🦄', name: 'unicorn face', keywords: ['unicorn', 'magic', 'horse', 'fantasy'] },
      { char: '🐝', name: 'honeybee', keywords: ['bee', 'bug', 'honey', 'insect'] },
      { char: '🐛', name: 'bug', keywords: ['caterpillar', 'bug', 'insect', 'worm'] },
      { char: '🦋', name: 'butterfly', keywords: ['butterfly', 'insect', 'fly', 'pretty'] },
      { char: '🐌', name: 'snail', keywords: ['snail', 'slow', 'shell'] },
      { char: '🐞', name: 'lady beetle', keywords: ['ladybug', 'bug', 'insect', 'red'] },
      { char: 'Ant', name: 'ant', keywords: ['ant', 'bug', 'insect', 'small'] },
      { char: '🐢', name: 'turtle', keywords: ['turtle', 'tortoise', 'slow', 'reptile'] },
      { char: '🐍', name: 'snake', keywords: ['snake', 'reptile', 'serpent'] },
      { char: '🦎', name: 'lizard', keywords: ['lizard', 'reptile'] },
      { char: '🐙', name: 'octopus', keywords: ['octopus', 'sea', 'ocean', 'tentacles'] },
      { char: '🦑', name: 'squid', keywords: ['squid', 'sea', 'ocean'] },
      { char: '🦀', name: 'crab', keywords: ['crab', 'sea', 'seafood', 'cancer'] },
      { char: '🐬', name: 'dolphin', keywords: ['dolphin', 'sea', 'ocean', 'mammal'] },
      { char: '🐳', name: 'spouting whale', keywords: ['whale', 'sea', 'ocean', 'water'] },
      { char: '🦈', name: 'shark', keywords: ['shark', 'fish', 'sea', 'ocean', 'predator'] },
      { char: '🐊', name: 'crocodile', keywords: ['crocodile', 'alligator', 'reptile'] },
      { char: '🐆', name: 'leopard', keywords: ['leopard', 'cat', 'wild'] },
      { char: '🦓', name: 'zebra', keywords: ['zebra', 'animal', 'stripes'] },
      { char: '🐘', name: 'elephant', keywords: ['elephant', 'animal', 'trunk'] },
      { char: '🦒', name: 'giraffe', keywords: ['giraffe', 'animal', 'tall'] },
      { char: '🐫', name: 'two-hump camel', keywords: ['camel', 'desert', 'hump'] },
      { char: '🐐', name: 'goat', keywords: ['goat', 'farm', 'animal'] },
      { char: '🐏', name: 'ram', keywords: ['ram', 'sheep', 'horns'] },
      { char: '🐑', name: 'ewe', keywords: ['sheep', 'wool', 'fluffy'] },
      { char: '🐕', name: 'dog', keywords: ['dog', 'pet', 'animal'] },
      { char: '🐈', name: 'cat', keywords: ['cat', 'pet', 'animal'] },
      { char: '🐈‍⬛', name: 'black cat', keywords: ['cat', 'black', 'halloween', 'spooky'] },
      { char: '🕊️', name: 'dove', keywords: ['dove', 'bird', 'peace', 'white'] },
      { char: '🐇', name: 'rabbit', keywords: ['rabbit', 'bunny', 'animal'] },
      { char: '🦥', name: 'sloth', keywords: ['sloth', 'slow', 'animal'] },
      { char: '🐿️', name: 'chipmunk', keywords: ['chipmunk', 'squirrel', 'acorn'] },
      { char: '🐾', name: 'paw prints', keywords: ['paw', 'prints', 'dog', 'cat', 'animal'] },
      { char: '🐉', name: 'dragon', keywords: ['dragon', 'mythical', 'china'] },
      { char: '🌵', name: 'cactus', keywords: ['cactus', 'desert', 'plant'] },
      { char: '🎄', name: 'Christmas tree', keywords: ['christmas', 'tree', 'holiday', 'xmas'] },
      { char: '🌲', name: 'evergreen tree', keywords: ['tree', 'pine', 'forest'] },
      { char: '🌳', name: 'deciduous tree', keywords: ['tree', 'green', 'forest'] },
      { char: '🌱', name: 'seedling', keywords: ['seedling', 'plant', 'grow', 'sprout'] },
      { char: '🌿', name: 'herb', keywords: ['herb', 'plant', 'leaf'] },
      { char: '☘️', name: 'shamrock', keywords: ['shamrock', 'clover', 'irish'] },
      { char: '🍀', name: 'four leaf clover', keywords: ['clover', 'lucky', 'irish', 'green'] },
      { char: '🍃', name: 'leaf fluttering in wind', keywords: ['leaf', 'wind', 'fall', 'nature'] },
      { char: '🍂', name: 'fallen leaf', keywords: ['leaf', 'fall', 'autumn', 'brown'] },
      { char: '🍁', name: 'maple leaf', keywords: ['maple', 'leaf', 'canada', 'fall'] },
      { char: '🍄', name: 'mushroom', keywords: ['mushroom', 'fungus'] },
      { char: '🐚', name: 'spiral shell', keywords: ['shell', 'beach', 'sea'] },
      { char: '🌾', name: 'sheaf of rice', keywords: ['rice', 'grain', 'harvest'] },
      { char: '💐', name: 'bouquet', keywords: ['bouquet', 'flowers', 'gift'] },
      { char: ' tulip', name: 'tulip', keywords: ['tulip', 'flower', 'spring'] },
      { char: '🌹', name: 'rose', keywords: ['rose', 'flower', 'love', 'red'] },
      { char: '🥀', name: 'wilted flower', keywords: ['wilted', 'flower', 'sad', 'dead'] },
      { char: '🌺', name: 'hibiscus', keywords: ['hibiscus', 'flower', 'tropical'] },
      { char: '🌸', name: 'cherry blossom', keywords: ['cherry', 'blossom', 'flower', 'pink', 'japan'] },
      { char: '🌼', name: 'blossom', keywords: ['blossom', 'flower', 'yellow'] },
      { char: '🌻', name: 'sunflower', keywords: ['sunflower', 'flower', 'yellow', 'summer'] },
      { char: '🌞', name: 'sun with face', keywords: ['sun', 'face', 'sunny', 'happy'] },
      { char: '🌝', name: 'full moon with face', keywords: ['moon', 'face', 'full'] },
      { char: '🌙', name: 'crescent moon', keywords: ['moon', 'crescent', 'night', 'space'] },
      { char: '💫', name: 'dizzy', keywords: ['dizzy', 'star', 'sparkle'] },
      { char: '⭐️', name: 'star', keywords: ['star', 'yellow', 'night'] },
      { char: '🌟', name: 'glowing star', keywords: ['star', 'glow', 'shine'] },
      { char: '✨', name: 'sparkles', keywords: ['sparkles', 'magic', 'shiny', 'clean', 'new'] },
      { char: '⚡️', name: 'high voltage', keywords: ['lightning', 'bolt', 'electric', 'power'] },
      { char: '☄️', name: 'comet', keywords: ['comet', 'space'] },
      { char: '💥', name: 'collision', keywords: ['explosion', 'collision', 'boom', 'bang'] },
      { char: '🔥', name: 'fire', keywords: ['fire', 'hot', 'flame', 'lit'] },
      { char: '🌈', name: 'rainbow', keywords: ['rainbow', 'color', 'rain'] },
      { char: '☀️', name: 'sun', keywords: ['sun', 'sunny', 'weather', 'hot'] },
      { char: '🌤️', name: 'sun behind small cloud', keywords: ['sun', 'cloud', 'weather'] },
      { char: '⛅️', name: 'sun behind cloud', keywords: ['sun', 'cloud', 'weather'] },
      { char: '☁️', name: 'cloud', keywords: ['cloud', 'weather', 'gray'] },
      { char: '🌧️', name: 'cloud with rain', keywords: ['rain', 'cloud', 'weather', 'wet'] },
      { char: '⛈️', name: 'cloud with lightning and rain', keywords: ['lightning', 'rain', 'storm', 'weather'] },
      { char: '❄️', name: 'snowflake', keywords: ['snowflake', 'cold', 'snow', 'winter'] },
      { char: '☃️', name: 'snowman', keywords: ['snowman', 'winter', 'cold', 'snow'] },
      { char: '💨', name: 'dashing away', keywords: ['wind', 'fast', 'smoke', 'fart'] },
      { char: '💧', name: 'droplet', keywords: ['drop', 'water', 'sweat', 'tear'] },
      { char: '💦', name: 'sweat droplets', keywords: ['sweat', 'water', 'drip', 'splash'] },
      { char: '🌊', name: 'water wave', keywords: ['wave', 'tsunami', 'sea', 'ocean', 'water'] },
    ],
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: '🍔',
    emojis: [
      { char: '🍏', name: 'green apple', keywords: ['apple', 'fruit', 'green', 'healthy'] },
      { char: '🍎', name: 'red apple', keywords: ['apple', 'fruit', 'red', 'healthy'] },
      { char: '🍊', name: 'tangerine', keywords: ['orange', 'tangerine', 'citrus', 'fruit'] },
      { char: '🍌', name: 'banana', keywords: ['banana', 'fruit', 'yellow'] },
      { char: '🍉', name: 'watermelon', keywords: ['watermelon', 'fruit', 'melon', 'summer'] },
      { char: '🍇', name: 'grapes', keywords: ['grapes', 'fruit', 'wine'] },
      { char: '🍓', name: 'strawberry', keywords: ['strawberry', 'fruit', 'berry', 'red'] },
      { char: '🫐', name: 'blueberries', keywords: ['blueberry', 'berry', 'fruit', 'blue'] },
      { char: '🍒', name: 'cherries', keywords: ['cherries', 'fruit', 'red'] },
      { char: '🍑', name: 'peach', keywords: ['peach', 'fruit', 'butt'] },
      { char: '🍍', name: 'pineapple', keywords: ['pineapple', 'fruit', 'tropical'] },
      { char: '🥥', name: 'coconut', keywords: ['coconut', 'fruit', 'tropical'] },
      { char: '🍅', name: 'tomato', keywords: ['tomato', 'vegetable', 'red'] },
      { char: '🥑', name: 'avocado', keywords: ['avocado', 'fruit', 'green', 'guacamole'] },
      { char: '🥦', name: 'broccoli', keywords: ['broccoli', 'vegetable', 'green'] },
      { char: '🌽', name: 'ear of corn', keywords: ['corn', 'vegetable', 'yellow'] },
      { char: '🥕', name: 'carrot', keywords: ['carrot', 'vegetable', 'orange'] },
      { char: '🥔', name: 'potato', keywords: ['potato', 'vegetable', 'carb'] },
      { char: '🥐', name: 'croissant', keywords: ['croissant', 'bread', 'pastry', 'france'] },
      { char: '🍞', name: 'bread', keywords: ['bread', 'toast', 'loaf'] },
      { char: '🥖', name: 'baguette bread', keywords: ['baguette', 'bread', 'france'] },
      { char: '🧀', name: 'cheese wedge', keywords: ['cheese', 'yellow', 'dairy'] },
      { char: '🍳', name: 'cooking', keywords: ['egg', 'pan', 'breakfast', 'cook'] },
      { char: '🥞', name: 'pancakes', keywords: ['pancakes', 'breakfast', 'syrup', 'sweet'] },
      { char: '🥓', name: 'bacon', keywords: ['bacon', 'meat', 'breakfast', 'pig'] },
      { char: '🥩', name: 'cut of meat', keywords: ['steak', 'meat', 'beef', 'steakhouse'] },
      { char: '🍔', name: 'hamburger', keywords: ['burger', 'hamburger', 'beef', 'fastfood'] },
      { char: '🍟', name: 'french fries', keywords: ['fries', 'french', 'chips', 'fastfood'] },
      { char: '🍕', name: 'pizza', keywords: ['pizza', 'cheese', 'italy', 'fastfood'] },
      { char: '🌭', name: 'hot dog', keywords: ['hotdog', 'fastfood', 'sausage'] },
      { char: '🥪', name: 'sandwich', keywords: ['sandwich', 'lunch', 'bread'] },
      { char: '🌮', name: 'taco', keywords: ['taco', 'mexican', 'mexico', 'fastfood'] },
      { char: '🌯', name: 'burrito', keywords: ['burrito', 'mexican', 'mexico', 'fastfood'] },
      { char: '🥗', name: 'green salad', keywords: ['salad', 'healthy', 'vegetable', 'green'] },
      { char: '🍣', name: 'sushi', keywords: ['sushi', 'fish', 'japanese', 'rice'] },
      { char: '🍤', name: 'fried shrimp', keywords: ['shrimp', 'tempura', 'seafood', 'fried'] },
      { char: '🥟', name: 'dumpling', keywords: ['dumpling', 'asian', 'dimsum'] },
      { char: '🥡', name: 'takeout box', keywords: ['takeout', 'box', 'asian', 'chinese'] },
      { char: '🍦', name: 'soft ice cream', keywords: ['icecream', 'cone', 'sweet', 'dessert'] },
      { char: '🍩', name: 'doughnut', keywords: ['donut', 'doughnut', 'sweet', 'dessert'] },
      { char: '🍪', name: 'cookie', keywords: ['cookie', 'biscuit', 'sweet', 'dessert'] },
      { char: '🎂', name: 'birthday cake', keywords: ['cake', 'birthday', 'celebrate', 'sweet'] },
      { char: '🍰', name: 'shortcake', keywords: ['cake', 'slice', 'sweet', 'dessert'] },
      { char: '🍫', name: 'chocolate bar', keywords: ['chocolate', 'candy', 'sweet'] },
      { char: '🍬', name: 'candy', keywords: ['candy', 'sweet', 'sugar'] },
      { char: '🍭', name: 'lollipop', keywords: ['lollipop', 'candy', 'sweet'] },
      { char: '🍯', name: 'honey pot', keywords: ['honey', 'sweet', 'bee'] },
      { char: '🥛', name: 'glass of milk', keywords: ['milk', 'dairy', 'drink'] },
      { char: '☕️', name: 'hot beverage', keywords: ['coffee', 'tea', 'hot', 'cafe', 'drink', 'mug'] },
      { char: '🍵', name: 'teacup without handle', keywords: ['tea', 'green', 'japanese', 'drink'] },
      { char: '🍶', name: 'sake', keywords: ['sake', 'japanese', 'drink', 'alcohol'] },
      { char: '🍾', name: 'bottle with popping cork', keywords: ['champagne', 'celebrate', 'party', 'alcohol', 'wine'] },
      { char: '🍷', name: 'wine glass', keywords: ['wine', 'alcohol', 'drink', 'red'] },
      { char: '🍸', name: 'cocktail glass', keywords: ['cocktail', 'martini', 'alcohol', 'drink'] },
      { char: '🍹', name: 'tropical drink', keywords: ['tropical', 'drink', 'cocktail', 'beach', 'alcohol'] },
      { char: '🍺', name: 'beer mug', keywords: ['beer', 'mug', 'alcohol', 'drink', 'pub'] },
      { char: '🍻', name: 'clinking beer mugs', keywords: ['beer', 'cheers', 'alcohol', 'drink', 'party'] },
      { char: '🥂', name: 'clinking glasses', keywords: ['cheers', 'champagne', 'wine', 'celebrate'] },
      { char: '🥤', name: 'cup with straw', keywords: ['soda', 'drink', 'juice', 'straw'] },
      { char: '🧊', name: 'ice', keywords: ['ice', 'cold', 'cube'] },
    ],
  },
  {
    id: 'activities',
    name: 'Activities',
    icon: '⚽',
    emojis: [
      { char: '🎮', name: 'video game', keywords: ['game', 'controller', 'play', 'console'] },
      { char: '🕹️', name: 'joystick', keywords: ['game', 'joystick', 'arcade', 'retro'] },
      { char: '🪄', name: 'magic wand', keywords: ['magic', 'wand', 'wizard', 'witch'] },
      { char: '🎈', name: 'balloon', keywords: ['balloon', 'party', 'celebrate', 'birthday'] },
      { char: '🎉', name: 'party popper', keywords: ['party', 'celebrate', 'congrats', 'birthday', 'yay'] },
      { char: '🎊', name: 'confetti ball', keywords: ['party', 'celebrate', 'confetti'] },
      { char: '🧸', name: 'teddy bear', keywords: ['teddy', 'bear', 'toy', 'cute'] },
      { char: '🎨', name: 'artist palette', keywords: ['paint', 'art', 'artist', 'draw'] },
      { char: '⚽️', name: 'soccer ball', keywords: ['soccer', 'football', 'ball', 'sport'] },
      { char: '🏀', name: 'basketball', keywords: ['basketball', 'ball', 'sport'] },
      { char: '🏈', name: 'american football', keywords: ['football', 'american', 'sport'] },
      { char: '⚾️', name: 'baseball', keywords: ['baseball', 'ball', 'sport'] },
      { char: '🥎', name: 'softball', keywords: ['softball', 'ball', 'sport'] },
      { char: '🎾', name: 'tennis', keywords: ['tennis', 'racket', 'ball', 'sport'] },
      { char: '🏉', name: 'rugby football', keywords: ['rugby', 'sport'] },
      { char: '🎱', name: 'pool 8 ball', keywords: ['pool', 'billiards', '8ball', 'game'] },
      { char: '🏓', name: 'ping pong', keywords: ['pingpong', 'tabletennis', 'sport', 'game'] },
      { char: '🥅', name: 'goal net', keywords: ['goal', 'net', 'soccer', 'hockey'] },
      { char: '⛳️', name: 'flag in hole', keywords: ['golf', 'flag', 'hole', 'sport'] },
      { char: '🎯', name: 'bullseye', keywords: ['target', 'dart', 'bullseye', 'game', 'hit'] },
      { char: ' bowling', name: 'bowling', keywords: ['bowling', 'ball', 'pins', 'sport', 'game'] },
      { char: '🥊', name: 'boxing glove', keywords: ['boxing', 'glove', 'fight', 'sport'] },
      { char: '🥋', name: 'martial arts uniform', keywords: ['karate', 'judo', 'taekwondo', 'martial'] },
      { char: '🛹', name: 'skateboard', keywords: ['skate', 'skateboard', 'board'] },
      { char: ' Skating', name: 'ice skate', keywords: ['skate', 'ice', 'winter'] },
      { char: '🏆', name: 'trophy', keywords: ['trophy', 'win', 'prize', 'award', 'first'] },
      { char: '🥇', name: '1st place medal', keywords: ['medal', 'gold', 'first', 'win'] },
      { char: '🥈', name: '2nd place medal', keywords: ['medal', 'silver', 'second'] },
      { char: '🥉', name: '3rd place medal', keywords: ['medal', 'bronze', 'third'] },
      { char: '🎫', name: 'ticket', keywords: ['ticket', 'show', 'movie', 'concert'] },
      { char: '🎟️', name: 'admission tickets', keywords: ['tickets', 'show', 'movie', 'concert'] },
      { char: '🎬', name: 'clapper board', keywords: ['movie', 'clapper', 'director', 'film'] },
      { char: '🎤', name: 'microphone', keywords: ['sing', 'mic', 'karaoke', 'speech'] },
      { char: '🎧', name: 'headphone', keywords: ['music', 'headphones', 'listen', 'audio'] },
      { char: '🎹', name: 'musical keyboard', keywords: ['piano', 'keyboard', 'music'] },
      { char: '🎷', name: 'saxophone', keywords: ['sax', 'saxophone', 'jazz', 'music'] },
      { char: '🎸', name: 'guitar', keywords: ['guitar', 'rock', 'music'] },
      { char: '🎲', name: 'game die', keywords: ['dice', 'die', 'game', 'boardgame'] },
    ],
  },
  {
    id: 'travel',
    name: 'Travel & Places',
    icon: '🚗',
    emojis: [
      { char: '🚗', name: 'automobile', keywords: ['car', 'automobile', 'drive', 'travel'] },
      { char: '🚕', name: 'taxi', keywords: ['taxi', 'cab', 'car', 'drive'] },
      { char: '🚙', name: 'sport utility vehicle', keywords: ['car', 'suv', 'blue', 'drive'] },
      { char: '🚌', name: 'bus', keywords: ['bus', 'transit', 'vehicle'] },
      { char: '🏎️', name: 'racing car', keywords: ['race', 'car', 'formula1'] },
      { char: '🚓', name: 'police car', keywords: ['police', 'cop', 'car', 'siren'] },
      { char: '🚑', name: 'ambulance', keywords: ['ambulance', 'hospital', 'er', 'emergency'] },
      { char: '🚒', name: 'fire engine', keywords: ['fire', 'truck', 'engine', 'emergency'] },
      { char: '🚐', name: 'minivan', keywords: ['van', 'minivan', 'car'] },
      { char: '🚜', name: 'tractor', keywords: ['tractor', 'farm', 'vehicle'] },
      { char: '🛵', name: 'motor scooter', keywords: ['scooter', 'vespa', 'moped'] },
      { char: '🏍️', name: 'motorcycle', keywords: ['motorcycle', 'bike', 'ride'] },
      { char: '🚲', name: 'bicycle', keywords: ['bike', 'bicycle', 'ride', 'cycle'] },
      { char: '⛽️', name: 'fuel pump', keywords: ['gas', 'fuel', 'petrol', 'station'] },
      { char: '🚨', name: 'police car light', keywords: ['siren', 'police', 'alarm', 'light', 'emergency'] },
      { char: '🚥', name: 'horizontal traffic light', keywords: ['traffic', 'light', 'stop'] },
      { char: '🚦', name: 'vertical traffic light', keywords: ['traffic', 'light', 'stop'] },
      { char: '🛑', name: 'stop sign', keywords: ['stop', 'sign', 'red'] },
      { char: '⚓️', name: 'anchor', keywords: ['anchor', 'ship', 'boat', 'sea'] },
      { char: '⛵️', name: 'sailboat', keywords: ['boat', 'sail', 'sailboat', 'sea'] },
      { char: '🚢', name: 'ship', keywords: ['ship', 'boat', 'cruise', 'ocean'] },
      { char: '✈️', name: 'airplane', keywords: ['plane', 'airplane', 'flight', 'fly', 'travel'] },
      { char: '🛫', name: 'airplane departure', keywords: ['takeoff', 'plane', 'flight', 'airport'] },
      { char: '🛬', name: 'airplane arrival', keywords: ['landing', 'plane', 'flight', 'airport'] },
      { char: '🚀', name: 'rocket', keywords: ['rocket', 'space', 'launch', 'nasa'] },
      { char: '🛸', name: 'flying saucer', keywords: ['ufo', 'alien', 'flying', 'saucer', 'space'] },
      { char: '🚪', name: 'door', keywords: ['door', 'home', 'room'] },
      { char: '🛋️', name: 'couch and lamp', keywords: ['couch', 'sofa', 'lamp', 'livingroom'] },
      { char: '🛏️', name: 'bed', keywords: ['bed', 'sleep', 'hotel'] },
      { char: '🎁', name: 'wrapped present', keywords: ['gift', 'present', 'birthday', 'christmas'] },
      { char: '🗺️', name: 'world map', keywords: ['map', 'travel', 'world', 'compass'] },
      { char: '🧭', name: 'compass', keywords: ['compass', 'navigation', 'direction', 'travel'] },
      { char: '🏔️', name: 'snow-capped mountain', keywords: ['mountain', 'snow', 'cold', 'nature'] },
      { char: '⛰️', name: 'mountain', keywords: ['mountain', 'nature', 'hill'] },
      { char: '🌋', name: 'volcano', keywords: ['volcano', 'lava', 'fire', 'erupt'] },
      { char: '🏕️', name: 'camping', keywords: ['camping', 'tent', 'nature', 'forest'] },
      { char: '🏖️', name: 'beach with umbrella', keywords: ['beach', 'umbrella', 'sand', 'sea', 'summer'] },
      { char: '🏜️', name: 'desert', keywords: ['desert', 'sand', 'hot', 'cactus'] },
      { char: '🏝️', name: 'desert island', keywords: ['island', 'beach', 'tropical', 'palm'] },
      { char: '🏠', name: 'house', keywords: ['house', 'home', 'building'] },
      { char: '🏡', name: 'house with garden', keywords: ['house', 'home', 'garden', 'suburb'] },
      { char: '🏢', name: 'office building', keywords: ['building', 'office', 'work'] },
      { char: '🏫', name: 'school', keywords: ['school', 'education', 'classroom', 'college'] },
      { char: '🏰', name: 'castle', keywords: ['castle', 'royal', 'kingdom', 'disney'] },
      { char: '⛪️', name: 'church', keywords: ['church', 'religion', 'building'] },
      { char: '🏛️', name: 'classical building', keywords: ['museum', 'temple', 'building'] },
      { char: '⛲️', name: 'fountain', keywords: ['fountain', 'water', 'park'] },
      { char: '⛺️', name: 'tent', keywords: ['tent', 'camping'] },
      { char: '🌃', name: 'night with stars', keywords: ['night', 'stars', 'city', 'sky'] },
      { char: '🏙️', name: 'cityscape', keywords: ['city', 'skyline', 'buildings'] },
      { char: '🌅', name: 'sunrise', keywords: ['sunrise', 'morning', 'sun'] },
      { char: '🌆', name: 'cityscape at dusk', keywords: ['sunset', 'dusk', 'city', 'skyline'] },
      { char: '🌉', name: 'bridge at night', keywords: ['bridge', 'night', 'sf', 'golden', 'gate'] },
      { char: '🎡', name: 'ferris wheel', keywords: ['ferris', 'wheel', 'carnival', 'fair'] },
      { char: '🎢', name: 'roller coaster', keywords: ['roller', 'coaster', 'theme', 'park'] },
    ],
  },
  {
    id: 'objects',
    name: 'Objects',
    icon: '💡',
    emojis: [
      { char: '⌚️', name: 'watch', keywords: ['watch', 'time', 'clock'] },
      { char: '📱', name: 'mobile phone', keywords: ['phone', 'mobile', 'smartphone', 'iphone'] },
      { char: '💻', name: 'laptop', keywords: ['laptop', 'computer', 'macbook', 'work'] },
      { char: '🖥️', name: 'desktop computer', keywords: ['computer', 'pc', 'screen'] },
      { char: '⌨️', name: 'keyboard', keywords: ['keyboard', 'computer', 'type'] },
      { char: '🖱️', name: 'computer mouse', keywords: ['mouse', 'click', 'computer'] },
      { char: '💾', name: 'floppy disk', keywords: ['floppy', 'disk', 'save', 'retro'] },
      { char: '💿', name: 'optical disk', keywords: ['cd', 'dvd', 'disk', 'music'] },
      { char: '📷', name: 'camera', keywords: ['camera', 'photo', 'picture'] },
      { char: '📸', name: 'camera with flash', keywords: ['camera', 'flash', 'photo', 'selfie'] },
      { char: '📹', name: 'video camera', keywords: ['video', 'camera', 'record'] },
      { char: '🎥', name: 'movie camera', keywords: ['movie', 'camera', 'film', 'cinema'] },
      { char: '📺', name: 'television', keywords: ['tv', 'television', 'screen', 'show'] },
      { char: '📻', name: 'radio', keywords: ['radio', 'music', 'broadcast'] },
      { char: '🎙️', name: 'studio microphone', keywords: ['podcast', 'microphone', 'record'] },
      { char: '⏰', name: 'alarm clock', keywords: ['alarm', 'clock', 'time', 'wake'] },
      { char: '⏳', name: 'hourglass not done', keywords: ['hourglass', 'time', 'sand', 'waiting'] },
      { char: '💡', name: 'light bulb', keywords: ['light', 'bulb', 'idea', 'inspiration', 'bright'] },
      { char: '🕯️', name: 'candle', keywords: ['candle', 'fire', 'light', 'wax'] },
      { char: '💸', name: 'money with wings', keywords: ['money', 'wings', 'cash', 'spend', 'fly'] },
      { char: '💵', name: 'dollar banknote', keywords: ['dollar', 'bill', 'money', 'cash', 'green'] },
      { char: '🪙', name: 'coin', keywords: ['coin', 'gold', 'money', 'crypto'] },
      { char: '💰', name: 'money bag', keywords: ['money', 'bag', 'cash', 'rich'] },
      { char: '💳', name: 'credit card', keywords: ['card', 'credit', 'debit', 'pay', 'shopping'] },
      { char: '💎', name: 'gem stone', keywords: ['gem', 'diamond', 'stone', 'jewel', 'shiny'] },
      { char: '⚖️', name: 'balance scale', keywords: ['scale', 'balance', 'justice', 'law'] },
      { char: '🔧', name: 'wrench', keywords: ['wrench', 'tool', 'fix', 'repair'] },
      { char: '🔨', name: 'hammer', keywords: ['hammer', 'tool', 'fix', 'build'] },
      { char: '🛠️', name: 'hammer and wrench', keywords: ['tools', 'hammer', 'wrench', 'fix', 'build'] },
      { char: '⚙️', name: 'gear', keywords: ['gear', 'cog', 'settings', 'wheel'] },
      { char: '⛓️', name: 'chains', keywords: ['chains', 'link', 'metal'] },
      { char: '🔫', name: 'water pistol', keywords: ['gun', 'pistol', 'water', 'toy'] },
      { char: '💣', name: 'bomb', keywords: ['bomb', 'explosion', 'ticking'] },
      { char: '🛡️', name: 'shield', keywords: ['shield', 'defense', 'protection', 'safe'] },
      { char: '🔑', name: 'key', keywords: ['key', 'lock', 'unlock', 'safe'] },
      { char: '🗝️', name: 'old key', keywords: ['key', 'old', 'antique', 'lock'] },
      { char: '📦', name: 'package', keywords: ['box', 'package', 'delivery', 'mail'] },
      { char: '✉️', name: 'envelope', keywords: ['envelope', 'mail', 'letter'] },
      { char: '📩', name: 'envelope with arrow', keywords: ['envelope', 'mail', 'letter', 'receive'] },
      { char: '📝', name: 'memo', keywords: ['memo', 'note', 'writing', 'paper'] },
      { char: '📅', name: 'calendar', keywords: ['calendar', 'date', 'month', 'schedule'] },
      { char: '📊', name: 'bar chart', keywords: ['chart', 'bar', 'graph', 'stats', 'data'] },
      { char: '📈', name: 'chart increasing', keywords: ['chart', 'up', 'growth', 'graph', 'stocks'] },
      { char: '📉', name: 'chart decreasing', keywords: ['chart', 'down', 'loss', 'graph', 'stocks'] },
      { char: '📋', name: 'clipboard', keywords: ['clipboard', 'list', 'todo', 'task'] },
      { char: '📌', name: 'pushpin', keywords: ['pin', 'pushpin', 'note', 'map'] },
      { char: '📍', name: 'round pushpin', keywords: ['pin', 'red', 'location', 'map'] },
      { char: '📎', name: 'paperclip', keywords: ['clip', 'paperclip', 'office'] },
      { char: ' Scissors', name: 'scissors', keywords: ['scissors', 'cut', 'tool'] },
      { char: '🗑️', name: 'wastebasket', keywords: ['trash', 'garbage', 'bin', 'delete'] },
      { char: '🔒', name: 'locked', keywords: ['lock', 'locked', 'secure', 'private'] },
      { char: '🔓', name: 'unlocked', keywords: ['lock', 'unlocked', 'open', 'secure'] },
      { char: '🛍️', name: 'shopping bags', keywords: ['shopping', 'bags', 'store', 'buying'] },
      { char: '🕶️', name: 'sunglasses', keywords: ['sunglasses', 'glasses', 'cool', 'sun'] },
      { char: '🎒', name: 'backpack', keywords: ['backpack', 'bag', 'school', 'travel'] },
    ],
  },
  {
    id: 'symbols',
    name: 'Symbols',
    icon: '🔣',
    emojis: [
      { char: '💘', name: 'heart with arrow', keywords: ['heart', 'love', 'cupid', 'arrow'] },
      { char: '💝', name: 'heart with ribbon', keywords: ['heart', 'gift', 'ribbon', 'love'] },
      { char: '💖', name: 'sparkling heart', keywords: ['heart', 'sparkle', 'love', 'pretty'] },
      { char: '💗', name: 'growing heart', keywords: ['heart', 'grow', 'love'] },
      { char: '💓', name: 'beating heart', keywords: ['heart', 'beat', 'pulse', 'love'] },
      { char: '💞', name: 'revolving hearts', keywords: ['hearts', 'love', 'circle'] },
      { char: '💕', name: 'two hearts', keywords: ['hearts', 'love'] },
      { char: '❣️', name: 'heart exclamation', keywords: ['heart', 'exclamation', 'punctuation'] },
      { char: '💔', name: 'broken heart', keywords: ['heart', 'broken', 'sad', 'heartbreak'] },
      { char: '❤️‍🔥', name: 'heart on fire', keywords: ['heart', 'fire', 'burn', 'passion'] },
      { char: '❤️', name: 'red heart', keywords: ['heart', 'love', 'red'] },
      { char: '🧡', name: 'orange heart', keywords: ['heart', 'orange', 'love'] },
      { char: '💛', name: 'yellow heart', keywords: ['heart', 'yellow', 'love'] },
      { char: '💚', name: 'green heart', keywords: ['heart', 'green', 'love'] },
      { char: '💙', name: 'blue heart', keywords: ['heart', 'blue', 'love'] },
      { char: '💜', name: 'purple heart', keywords: ['heart', 'purple', 'love'] },
      { char: '🤎', name: 'brown heart', keywords: ['heart', 'brown', 'love'] },
      { char: '🖤', name: 'black heart', keywords: ['heart', 'black', 'love'] },
      { char: '🤍', name: 'white heart', keywords: ['heart', 'white', 'love'] },
      { char: '💯', name: 'hundred points', keywords: ['100', 'perfect', 'score', 'excellent'] },
      { char: '💬', name: 'speech balloon', keywords: ['bubble', 'speech', 'chat', 'message'] },
      { char: '💭', name: 'thought balloon', keywords: ['bubble', 'thought', 'think', 'dream'] },
      { char: '💤', name: 'zzz', keywords: ['zzz', 'sleep', 'tired', 'snore'] },
      { char: '⚠️', name: 'warning', keywords: ['warning', 'alert', 'danger', 'triangle'] },
      { char: '🚫', name: 'prohibited', keywords: ['no', 'ban', 'prohibited', 'circle', 'slash'] },
      { char: '🔞', name: 'no one under eighteen', keywords: ['18', 'restricted', 'age', 'adult'] },
      { char: '⬆️', name: 'up arrow', keywords: ['arrow', 'up', 'direction'] },
      { char: '➡️', name: 'right arrow', keywords: ['arrow', 'right', 'direction'] },
      { char: '⬇️', name: 'down arrow', keywords: ['arrow', 'down', 'direction'] },
      { char: '⬅️', name: 'left arrow', keywords: ['arrow', 'left', 'direction'] },
      { char: '🔄', name: 'counterclockwise arrows button', keywords: ['reload', 'refresh', 'arrows'] },
      { char: '▶️', name: 'play button', keywords: ['play', 'button', 'video', 'music'] },
      { char: '⏸', name: 'pause button', keywords: ['pause', 'button', 'video', 'music'] },
      { char: '⏹', name: 'stop button', keywords: ['stop', 'button', 'video', 'music'] },
      { char: '📶', name: 'antenna bars', keywords: ['signal', 'reception', 'wifi', 'connection'] },
      { char: '📳', name: 'vibration mode', keywords: ['vibrate', 'phone', 'ring'] },
      { char: '📴', name: 'mobile phone off', keywords: ['off', 'phone', 'silent'] },
    ],
  },
  {
    id: 'flags',
    name: 'Flags',
    icon: '🏁',
    emojis: [
      { char: '🏁', name: 'chequered flag', keywords: ['race', 'flag', 'chequered', 'finish'] },
      { char: '🚩', name: 'triangular flag', keywords: ['flag', 'red', 'mark'] },
      { char: '🏳️‍🌈', name: 'rainbow flag', keywords: ['flag', 'rainbow', 'pride', 'lgbt'] },
      { char: '🏳️‍⚧️', name: 'transgender flag', keywords: ['flag', 'transgender', 'pride'] },
      { char: '🏴‍☠️', name: 'pirate flag', keywords: ['flag', 'pirate', 'skull', 'crossbones'] },
      { char: '🇺🇸', name: 'flag: United States', keywords: ['flag', 'usa', 'america', 'united', 'states'] },
      { char: '🇬🇧', name: 'flag: United Kingdom', keywords: ['flag', 'uk', 'britain', 'united', 'kingdom'] },
      { char: '🇮🇳', name: 'flag: India', keywords: ['flag', 'india', 'in'] },
      { char: '🇨🇦', name: 'flag: Canada', keywords: ['flag', 'canada', 'ca'] },
      { char: '🇦🇺', name: 'flag: Australia', keywords: ['flag', 'australia', 'au'] },
      { char: '🇩🇪', name: 'flag: Germany', keywords: ['flag', 'germany', 'de'] },
      { char: '🇫🇷', name: 'flag: France', keywords: ['flag', 'france', 'fr'] },
      { char: '🇯🇵', name: 'flag: Japan', keywords: ['flag', 'japan', 'jp'] },
      { char: '🇨🇳', name: 'flag: China', keywords: ['flag', 'china', 'cn'] },
      { char: '🇧🇷', name: 'flag: Brazil', keywords: ['flag', 'brazil', 'br'] },
      { char: '🇷🇺', name: 'flag: Russia', keywords: ['flag', 'russia', 'ru'] },
      { char: '🇪🇸', name: 'flag: Spain', keywords: ['flag', 'spain', 'es'] },
      { char: '🇮🇹', name: 'flag: Italy', keywords: ['flag', 'italy', 'it'] },
      { char: '🇲🇽', name: 'flag: Mexico', keywords: ['flag', 'mexico', 'mx'] },
      { char: '🇰🇷', name: 'flag: South Korea', keywords: ['flag', 'korea', 'kr'] },
      { char: '🇸🇬', name: 'flag: Singapore', keywords: ['flag', 'singapore', 'sg'] },
      { char: '🇦🇪', name: 'flag: United Arab Emirates', keywords: ['flag', 'uae', 'emirates'] },
    ],
  },
];

const AVATAR_TEMPLATES = [
  { id: 'leo', name: 'Leo', seed: 'Leo' },
  { id: 'mia', name: 'Mia', seed: 'Mia' },
  { id: 'sam', name: 'Sam', seed: 'Sam' },
  { id: 'ava', name: 'Ava', seed: 'Ava' },
  { id: 'zoe', name: 'Zoe', seed: 'Zoe' },
  { id: 'max', name: 'Max', seed: 'Max' },
];

const AVATAR_REACTIONS = [
  { id: 'hi', name: 'Hi!', eyes: 'default', mouth: 'smile' },
  { id: 'love', name: 'Love', eyes: 'hearts', mouth: 'smile' },
  { id: 'haha', name: 'Haha', eyes: 'happy', mouth: 'smile' },
  { id: 'sad', name: 'Sad', eyes: 'cry', mouth: 'sad' },
  { id: 'shocked', name: 'Shocked', eyes: 'surprised', mouth: 'screamingOpen' },
  { id: 'wink', name: 'Wink', eyes: 'wink', mouth: 'smile' },
  { id: 'playful', name: 'Playful', eyes: 'default', mouth: 'tongue' },
  { id: 'grimace', name: 'Grimace', eyes: 'default', mouth: 'grimace' },
  { id: 'angry', name: 'Angry', eyes: 'angry', mouth: 'grimace' },
  { id: 'dizzy', name: 'Dizzy', eyes: 'dizzy', mouth: 'grimace' },
  { id: 'concerned', name: 'Concerned', eyes: 'concerned', mouth: 'concerned' },
  { id: 'yum', name: 'Yum', eyes: 'happy', mouth: 'eating' },
];

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker?: (stickerUrl: string) => void;
  mode?: 'emoji' | 'sticker';
  isDark?: boolean;
}

export function EmojiPicker({ onSelectEmoji, onSelectSticker, mode = 'emoji', isDark = true }: EmojiPickerProps) {
  const T = {
    bg: isDark ? '#0E0726' : '#FFFFFF',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    headerBg: isDark ? '#0A0420' : '#F9F9FB',
    dim: isDark ? '#A3A0AB' : '#6B7280',
    dim2: isDark ? '#8C8896' : '#6B7280',
    inputBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    inputBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    text: isDark ? '#FFFFFF' : '#1B1528',
    placeholderBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    pressedBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
  };
  const [searchText, setSearchText] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('smileys');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [avatarSeed, setAvatarSeed] = useState('Leo');

  // Load recent emojis on mount
  useEffect(() => {
    (async () => {
      try {
        const storedVal = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedVal) {
          const parsed = JSON.parse(storedVal) as string[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRecentEmojis(parsed);
            setSelectedCategoryId('recent'); // Auto select recent on mount if it exists!
          }
        }
      } catch (err) {
        console.warn('Failed to load recent emojis:', err);
      }
    })();
  }, []);

  // Save selected emoji to recents and trigger callback
  const handleEmojiPress = async (emojiChar: string) => {
    onSelectEmoji(emojiChar);

    // Update recent emojis
    const updated = [emojiChar, ...recentEmojis.filter((e) => e !== emojiChar)].slice(0, 32);
    setRecentEmojis(updated);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save recent emojis:', err);
    }
  };

  // Compile full categories list, inserting 'recent' at start if present
  const categories = useMemo(() => {
    const list = [...EMOJI_DATA];
    if (recentEmojis.length > 0) {
      // Map simple string arrays of recent emojis into the structure
      const recentList: EmojiItem[] = recentEmojis.map((char) => {
        // Try to look up keywords from EMOJI_DATA
        let name = 'recent emoji';
        let keywords: string[] = [];
        for (const cat of EMOJI_DATA) {
          const found = cat.emojis.find((e) => e.char === char);
          if (found) {
            name = found.name;
            keywords = found.keywords;
            break;
          }
        }
        return { char, name, keywords };
      });

      list.unshift({
        id: 'recent',
        name: 'Recent',
        icon: '🕒',
        emojis: recentList,
      });
    }
    return list;
  }, [recentEmojis]);

  // Compute filtered emojis for grid rendering
  const filteredEmojis = useMemo(() => {
    if (!searchText.trim()) {
      const activeCat = categories.find((cat) => cat.id === selectedCategoryId);
      return activeCat ? activeCat.emojis : [];
    }

    // Match search term against name or keywords in all categories (flattened)
    const term = searchText.toLowerCase().trim();
    const matches: EmojiItem[] = [];
    const seen = new Set<string>();

    for (const cat of EMOJI_DATA) {
      for (const e of cat.emojis) {
        if (seen.has(e.char)) continue;

        const matchesName = e.name.toLowerCase().includes(term);
        const matchesKeyword = e.keywords.some((k) => k.toLowerCase().includes(term));

        if (matchesName || matchesKeyword) {
          matches.push(e);
          seen.add(e.char);
        }
      }
    }
    return matches;
  }, [searchText, selectedCategoryId, categories]);

  // Clear search query
  const handleClearSearch = () => {
    setSearchText('');
  };

  return (
    <View style={[styles.container, { backgroundColor: T.bg, borderTopColor: T.border }, mode === 'sticker' ? { height: 340 } : { height: 310 }]}>
      {mode === 'emoji' ? (
        <>
          {/* Category Navigation Bar */}
          <View style={styles.tabContainer}>
            {categories.map((cat) => {
              const isSelected = cat.id === selectedCategoryId;
              return (
                <Pressable
                  key={cat.id}
                  style={[styles.tabBtn, isSelected && styles.tabBtnActive]}
                  onPress={() => {
                    setSelectedCategoryId(cat.id);
                    // Clear search when switching tabs to make interaction simple and predictable
                    setSearchText('');
                  }}
                >
                  <Text style={[styles.tabIcon, isSelected && styles.tabIconActive]}>
                    {cat.icon}
                  </Text>
                  {isSelected && <View style={styles.tabUnderline} />}
                </Pressable>
              );
            })}
          </View>

          {/* Search Input Box */}
          <View style={styles.searchWrap}>
            <View style={styles.searchBar}>
              <Svg viewBox="0 0 24 24" width={18} height={18} style={styles.searchIcon}>
                <Circle cx="11" cy="11" r="8" fill="none" stroke="#8C8896" strokeWidth={2} />
                <Path d="M21 21l-4.35-4.35" fill="none" stroke="#8C8896" strokeWidth={2} strokeLinecap="round" />
              </Svg>
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search emoji"
                placeholderTextColor="#8C8896"
                style={styles.searchInput}
                disableFullscreenUI
                autoCorrect={false}
              />
              {searchText.length > 0 && (
                <Pressable onPress={handleClearSearch} hitSlop={10} style={styles.clearBtn}>
                  <Svg viewBox="0 0 24 24" width={16} height={16}>
                    <Path d="M18 6L6 18M6 6l12 12" fill="none" stroke="#8C8896" strokeWidth={2} strokeLinecap="round" />
                  </Svg>
                </Pressable>
              )}
            </View>
          </View>

          {/* Emoji Selection Grid */}
          <View style={styles.gridContainer}>
            {filteredEmojis.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No emojis found</Text>
              </View>
            ) : (
              <FlatList
                data={filteredEmojis}
                keyExtractor={(item) => item.char}
                numColumns={NUM_COLUMNS}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [
                      styles.emojiBtn,
                      pressed && styles.emojiBtnPressed,
                    ]}
                    onPress={() => handleEmojiPress(item.char)}
                  >
                    <Text style={styles.emojiText}>{item.char}</Text>
                  </Pressable>
                )}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                // Optimize render lists for large emoji sets
                initialNumToRender={48}
                maxToRenderPerBatch={48}
                windowSize={5}
                removeClippedSubviews={true}
              />
            )}
          </View>
        </>
      ) : (
        <>
          {/* Stickers Header & Avatar Creator */}
          <View style={[styles.avatarCreatorWrap, { backgroundColor: T.headerBg, borderBottomColor: T.border }]}>
            <View style={styles.avatarInputRow}>
              <Text style={[styles.avatarLabel, { color: T.dim }]}>Avatar seed:</Text>
              <TextInput
                value={avatarSeed}
                onChangeText={setAvatarSeed}
                placeholder="Type name..."
                placeholderTextColor={T.dim2}
                style={[styles.avatarInput, { backgroundColor: T.inputBg, color: T.text, borderColor: T.inputBorder }]}
                autoCorrect={false}
                maxLength={20}
              />
            </View>
            <View style={styles.templatesRow}>
              {AVATAR_TEMPLATES.map((tmpl) => {
                const isActive = avatarSeed.toLowerCase().trim() === tmpl.seed.toLowerCase().trim();
                const previewUrl = `https://api.dicebear.com/9.x/avataaars/png?seed=${tmpl.seed}&eyes=default&mouth=smile`;
                return (
                  <Pressable
                    key={tmpl.id}
                    style={[styles.templateBtn, isActive && styles.templateBtnActive]}
                    onPress={() => setAvatarSeed(tmpl.seed)}
                  >
                    <Image source={{ uri: previewUrl }} style={[styles.templatePreview, { backgroundColor: T.placeholderBg }]} />
                    <Text style={[styles.templateText, { color: T.dim2 }, isActive && styles.templateTextActive]}>
                      {tmpl.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Stickers Grid */}
          <View style={styles.gridContainer}>
            <FlatList
              data={AVATAR_REACTIONS}
              keyExtractor={(item) => item.id}
              numColumns={3}
              renderItem={({ item }) => {
                const stickerUrl = `https://api.dicebear.com/9.x/avataaars/png?seed=${avatarSeed.trim() || 'AstroUser'}&eyes=${item.eyes}&mouth=${item.mouth}`;
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.stickerBtn,
                      pressed && [styles.stickerBtnPressed, { backgroundColor: T.pressedBg }],
                    ]}
                    onPress={() => onSelectSticker?.(stickerUrl)}
                  >
                    <Image source={{ uri: stickerUrl }} style={styles.stickerImage} contentFit="contain" />
                    <Text style={[styles.stickerName, { color: T.dim }]}>{item.name}</Text>
                  </Pressable>
                );
              }}
              contentContainerStyle={styles.stickerListContent}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0E0726',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    height: 48,
    backgroundColor: '#0A0420',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    position: 'relative',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.5,
  },
  tabIconActive: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 3,
    backgroundColor: '#A855F7',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  searchWrap: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0E0726',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  gridContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  listContent: {
    paddingBottom: 20,
    paddingTop: 4,
  },
  emojiBtn: {
    width: EMOJI_SIZE,
    height: EMOJI_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  emojiBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    transform: [{ scale: 0.88 }],
  },
  emojiText: {
    fontSize: 28,
    color: '#FFFFFF',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  emptyText: {
    color: '#8C8896',
    fontSize: 14,
  },
  // Avatar Creator styling
  avatarCreatorWrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0A0420',
  },
  avatarInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  avatarLabel: {
    color: '#A3A0AB',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  avatarInput: {
    flex: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  templatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 4,
  },
  templateBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  templateBtnActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  templatePreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  templateText: {
    color: '#8C8896',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
  templateTextActive: {
    color: '#A855F7',
    fontWeight: '600',
  },
  stickerListContent: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  stickerBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    margin: 4,
    borderRadius: 12,
  },
  stickerBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    transform: [{ scale: 0.95 }],
  },
  stickerImage: {
    width: SCREEN_WIDTH / 4.2,
    height: SCREEN_WIDTH / 4.2,
  },
  stickerName: {
    color: '#A3A0AB',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
});
