import * as _ from "lodash"
import { InMemoryStorage } from "tuple-database/storage/InMemoryStorage"
import { write } from "../database/write"

export function createContactsDb() {
	const people: Array<{ id: string; firstName: string; lastName: string }> = [
		{ id: "XXX1", firstName: "Chet", lastName: "Corcos" },
		{ id: "XXX2", firstName: "Sam", lastName: "Corcos" },
		{ id: "XXX3", firstName: "Leon", lastName: "Corcos" },
		{ id: "XXX4", firstName: "Andrew", lastName: "Langdon" },
		{ id: "XXX5", firstName: "Wes", lastName: "Haas" },
		{ id: "XXX6", firstName: "Simon", lastName: "Last" },
	]

	const storage = new InMemoryStorage()
	const transaction = storage.transact()
	for (const person of people) {
		write(transaction, {
			set: [
				[person.id, "type", "person"],
				[person.id, "firstName", person.firstName],
				[person.id, "lastName", person.lastName],
			],
		})
	}
	write(transaction, {
		set: [
			["AAA", "type", "person"],
			["BBB", "firstName", "B"],
			["CCC", "lastName", "C"],
		],
	})
	transaction.commit()
	return storage
}

export function createFamilyDb() {
	const storage = new InMemoryStorage()
	const transaction = storage.transact()

	write(transaction, {
		set: [
			["chet", "mom", "deborah"],
			["deborah", "sister", "sue"],
			["deborah", "sister", "melanie"],
			["deborah", "sister", "ruth"],
			["chet", "dad", "leon"],
			["leon", "sister", "stephanie"],
		],
	})

	transaction.commit()
	return storage
}
