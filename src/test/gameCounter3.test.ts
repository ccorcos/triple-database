/*

Can we change those reducers so they make more sense?
Easier to write as simple transactions on tbe database...

Hard part: construct and object, and immutably update the object when facts change.
Actually... what if we listen to that whole query?
1. That way we can encourage objects to break up their listening.
2. We can always add this more efficient update later -- spec it out and hire someone.


Right now...
- game counter with db tx for writes.
- reconstruct the objects
- listen for changes
- break up the object queries/listeners.
*/

import * as t from "data-type-ts"
import { ReadOnlyTupleStorage } from "tuple-database/storage/types"

function objToFacts(obj: any) {}

function readObj(db: ReadOnlyTupleStorage, id: string) {}

const ID = t.object({ required: { uuid: t.string }, optional: {} })

// function newPlayer(): typeof ID.value {
// 	const id: typeof ID.value = { uuid: randomId() }

// 	return { id: randomId(), name: "", score: 0 }
// }

// function newGame(): typeof Game.value {
// 	return { id: randomId(), players: [newPlayer()] }
// }

// const reducers = {
// 	addPlayer(game: typeof Game.value) {
// 		const { players } = game
// 		return { id: game.id, players: [...players, newPlayer()] }
// 	},
// 	deletePlayer(game: typeof Game.value, index: number) {
// 		const { players } = game
// 		const newPlayers = [...players]
// 		newPlayers.splice(index, 1)
// 		return { id: game.id, players: newPlayers }
// 	},
// 	editName(game: typeof Game.value, index: number, newName: string) {
// 		const players = game.players.map((player, i) => {
// 			if (i !== index) return player
// 			return { ...player, name: newName }
// 		})
// 		return { id: game.id, players }
// 	},
// 	incrementScore(game: typeof Game.value, index: number, delta: number) {
// 		const players = game.players.map((player, i) => {
// 			if (i !== index) return player
// 			return { ...player, score: player.score + delta }
// 		})
// 		return { id: game.id, players }
// 	},
// 	resetGame(game: typeof Game.value) {
// 		return newGame()
// 	},
// }
