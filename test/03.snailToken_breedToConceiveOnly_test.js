//SPDX-License-Identifier: UNLICENSED
// Written by Mark Suscens, Copyright 2022, all rights reserved.

const truffleAssert = require("truffle-assertions")
const timeMachine = require('ganache-time-traveler')

// Test Helpers
const calcFertilisationTH= require('./TestHelpers/SnailTH.js').calcFertilisationTH

const SnailToken = artifacts.require("SnailToken")

const SNAIL_TOKEN_NAME = "Snail Token"
const SNAIL_TOKEN_SYMBOL = "SNL"


contract.skip("03 SnailToken - Two snails breedToConceiveOnly (no new snails born/minted)", async accounts => {

    "use strict"

    let snailToken

    before("Deploy SnailToken contract", async function() {

        await truffleAssert.passes(
            snailToken = await SnailToken.deployed(SNAIL_TOKEN_NAME, SNAIL_TOKEN_SYMBOL)
        )
    })

    const conception = {
        generation: 0,
        mumId: 0,
        dadId: 0
    }

    before("Mint 2x snails for accounts[2] (tokenId:s 0 & 1)", async() => {

        await truffleAssert.passes(
            snailToken.mintSnailsTo(
                accounts[2],                //owner
                [conception, conception],   //conceptions
                {from: accounts[0]}
            )
        )
    })

    before("Mint 1x snail for accounts[0] (tokenId: 2)", async() => {

        await truffleAssert.passes(
            snailToken.mintSnailsTo(
                accounts[0],   //owner
                [conception],  //conceptions
                {from: accounts[0]}
            )
        )
    })
    // CURRENT STATE: 3x Gen0 Snail tokens exist 
    const A_SNAIL_ID = 0 //Owner accounts[2]
    const B_SNAIL_ID = 1 //Owner accounts[2]
    const C_SNAIL_ID = 2 //Owner accounts[0]


    describe("Breed Snails: Both mates must be present", () => {

        let snapshotId
        beforeEach("Save Initial Setup State (of blockchain)", async() => {
            let snapshot = await timeMachine.takeSnapshot()
            snapshotId = snapshot['result']
        })

        afterEach("Restore To Initial Setup State (of blockchain)", async() => {
            await timeMachine.revertToSnapshot(snapshotId)
        })


        it("should NOT allow breedToConceiveOnly if neither mate is present (owned/approved)", async () => {

            await truffleAssert.reverts(
                snailToken.breedToConceiveOnly(
                    A_SNAIL_ID, //mateA - owned by accounts[2]
                    B_SNAIL_ID, //mateB - owned by accounts[2]
                    {from: accounts[0]}
                ),
                "breed: mateA is not present!"
            )
        })

        it("should NOT allow breedToConceiveOnly if only one mate is present (owned/approved)", async () => {

            await truffleAssert.reverts(
                snailToken.breedToConceiveOnly(
                    C_SNAIL_ID, //mateA - owned by accounts[0]
                    A_SNAIL_ID, //mateB - owned by accounts[2]
                    {from: accounts[2]}
                ),
                "breed: mateA is not present!"
            )
            await truffleAssert.reverts(
                snailToken.breedToConceiveOnly(
                    A_SNAIL_ID, //mateA - owned by accounts[2] 
                    C_SNAIL_ID, //mateB - owned by accounts[0]
                    {from: accounts[2]}
                ),
                "breed: mateB is not present!"
            )
        })

        it("should NOT allow a snail to be breedToConceiveOnly with itself", async () => {

            await truffleAssert.reverts(
                snailToken.breedToConceiveOnly(
                    A_SNAIL_ID, //mateA
                    A_SNAIL_ID, //mateB
                    {from: accounts[2]}
                ),
                "breed: With self!"
            )
        })
    })


    describe("Breed Two Snails (with pseudo-random chance that each mate produces 1x newborn smail): ", () => {

        let genMateA
        let genMateB
        before(`Get snails' Generations (MateA snailId: ${A_SNAIL_ID} & MateB's snailId: ${B_SNAIL_ID})`, async function() {
    
            let snailMateA
            await truffleAssert.passes(
                snailMateA = await snailToken.getSnail(A_SNAIL_ID),
                `Unable to getSnail of snailId ${A_SNAIL_ID}`
            )
            genMateA = Number(snailMateA.age.generation)

            let snailMateB
            await truffleAssert.passes(
                snailMateB = await snailToken.getSnail(B_SNAIL_ID),
                `Unable to getSnail of snailId ${B_SNAIL_ID}`
            )
            genMateB = Number(snailMateB.age.generation)
        })

        let mintedSnailsOrig
        let lastOrigSnailId
        let nextSnailId
        before("Get number minted snails (and last/next tokenId)", async function() {

            await truffleAssert.passes(
                mintedSnailsOrig = await snailToken.totalSupply(),
                "Unable to get the amount of snails minted"
            )
            mintedSnailsOrig = Number(mintedSnailsOrig)
            lastOrigSnailId = lastOrigSnailId-1
            nextSnailId = mintedSnailsOrig
        })

        let snapshotId
        beforeEach("Save Initial Setup State (of blockchain)", async() => {
            let snapshot = await timeMachine.takeSnapshot()
            snapshotId = snapshot['result']
        })

        afterEach("Restore To Initial Setup State (of blockchain)", async() => {
            await timeMachine.revertToSnapshot(snapshotId)
        })


        it("should allow suitable mates to breedToConceiveOnly", async () => {

            await truffleAssert.passes(
                snailToken.breedToConceiveOnly(
                    A_SNAIL_ID, //mateA                
                    B_SNAIL_ID, //mateB
                    {from: accounts[2]}),
                "Snail owner was unable to breed their snails"
            )
        })

        it("should get expected (pseudo-random) fertilisation from each breedToConceiveOnly (test for 3x breeds)", async () => {

            // Breed (for 1st-time)
            let txBreedResult1
            await truffleAssert.passes(
                txBreedResult1 = await snailToken.breedToConceiveOnly(
                    A_SNAIL_ID, //mateA                
                    B_SNAIL_ID, //mateB
                    {from: accounts[2]}),
                "Snail owner was unable to breed their snails"
            )

            const fertlisationResult1 = await calcFertilisationTH(txBreedResult1)
            const expectMateAFertilised1 = fertlisationResult1.expectMateAFertilised
            const expectMateBFertilised1 = fertlisationResult1.expectMateBFertilised

            truffleAssert.eventEmitted(txBreedResult1, 'SnailsMated', (ev) => {
                console.log(`\t1. Actual fertilisation result, mate A: ${ev.mateAFertilised}; mate B: ${ev.mateBFertilised}`)
                console.log(`\t1. Expect fertilisation result, mate A: ${expectMateAFertilised1}; mate B: ${expectMateBFertilised1}`)
                return Number(ev.snailIdMateA) === A_SNAIL_ID &&
                    Number(ev.snailIdMateB) === B_SNAIL_ID &&
                    Boolean(ev.mateAFertilised) === expectMateAFertilised1 &&
                    Boolean(ev.mateBFertilised) === expectMateBFertilised1
            }, "1. Event SnailsMated event has incorrect/unexpected parameter values!")

            // Breed for 2nd-time
            let txBreedResult2
            await truffleAssert.passes(
                txBreedResult2 = await snailToken.breedToConceiveOnly(
                    A_SNAIL_ID, //mateA                
                    B_SNAIL_ID, //mateB
                    {from: accounts[2]}),
                "Snail owner was unable to breed their snails"
            )

            const fertlisationResult2 = await calcFertilisationTH(txBreedResult2);
            const expectMateAFertilised2 = fertlisationResult2.expectMateAFertilised
            const expectMateBFertilised2 = fertlisationResult2.expectMateBFertilised

            truffleAssert.eventEmitted(txBreedResult2, 'SnailsMated', (ev) => {
                console.log(`\t2. Actual fertilisation result, mate A: ${ev.mateAFertilised}; mate B: ${ev.mateBFertilised}`)
                console.log(`\t2. Expect fertilisation result, mate A: ${expectMateAFertilised2}; mate B: ${expectMateBFertilised2}`)
                return Number(ev.snailIdMateA) === A_SNAIL_ID &&
                    Number(ev.snailIdMateB) === B_SNAIL_ID &&
                    Boolean(ev.mateAFertilised) === expectMateAFertilised2 &&
                    Boolean(ev.mateBFertilised) === expectMateBFertilised2
            }, "2. Event SnailsMated event has incorrect/unexpected parameter values!")

            // Breed for 3rd-time
            let txBreedResult3
            await truffleAssert.passes(
                txBreedResult3 = await snailToken.breedToConceiveOnly(
                    A_SNAIL_ID, //mateA                
                    B_SNAIL_ID, //mateB
                    {from: accounts[2]}),
                "Snail owner was unable to breed their snails"
            )

            const fertlisationResult3 = await calcFertilisationTH(txBreedResult3);
            const expectMateAFertilised3 = fertlisationResult3.expectMateAFertilised
            const expectMateBFertilised3 = fertlisationResult3.expectMateBFertilised

            truffleAssert.eventEmitted(txBreedResult3, 'SnailsMated', (ev) => {
                console.log(`\t3. Actual fertilisation result, mate A: ${ev.mateAFertilised}; mate B: ${ev.mateBFertilised}`)
                console.log(`\t3. Expect fertilisation result, mate A: ${expectMateAFertilised3}; mate B: ${expectMateBFertilised3}`)
                return Number(ev.snailIdMateA) === A_SNAIL_ID &&
                    Number(ev.snailIdMateB) === B_SNAIL_ID &&
                    Boolean(ev.mateAFertilised) === expectMateAFertilised3 &&
                    Boolean(ev.mateBFertilised) === expectMateBFertilised3
            }, "3. Event SnailsMated event has incorrect/unexpected parameter values!")            
        })

        it("should get expected (pseudo-random) conception result from each breedToConceiveOnly (test for 3x breeds)", async () => {

            // Breed (for the first time)
            let txBreedResult1
            await truffleAssert.passes(
                txBreedResult1 = await snailToken.breedToConceiveOnly(
                    A_SNAIL_ID, //mateA                
                    B_SNAIL_ID, //mateB
                    {from: accounts[2]}),
                "Snail owner was unable to breed their snails"
            )

            const fertlisationResult1 = await calcFertilisationTH(txBreedResult1)
            const expectMateAFertilised1 = fertlisationResult1.expectMateAFertilised
            const expectMateBFertilised1 = fertlisationResult1.expectMateBFertilised

            truffleAssert.eventEmitted(txBreedResult1, 'SnailsMated', (ev) => {

                if (expectMateAFertilised1 && expectMateBFertilised1) {
                    console.log("\tBreed 1: 2x conceptions - mates A & B")
                    return ev.conceptions.length === 2 &&
                        Number(ev.conceptions[0].mumId) === A_SNAIL_ID &&
                        Number(ev.conceptions[0].dadId) === B_SNAIL_ID &&
                        Number(ev.conceptions[0].generation) === 1 &&
                        Number(ev.conceptions[1].mumId) === B_SNAIL_ID &&
                        Number(ev.conceptions[1].dadId) === A_SNAIL_ID &&
                        Number(ev.conceptions[1].generation) === 1
                }
                if (expectMateAFertilised1 && !expectMateBFertilised1) {
                    console.log("\tBreed 1: 1x conceptions - mateA only")
                    return ev.conceptions.length === 1 &&
                        Number(ev.conceptions[0].mumId) === A_SNAIL_ID &&
                        Number(ev.conceptions[0].dadId) === B_SNAIL_ID &&
                        Number(ev.conceptions[0].generation) === 1
                }
                if (expectMateBFertilised1 && !expectMateAFertilised1) {
                    console.log("\tBreed 1: 1x conceptions - mateB only")
                    return ev.conceptions.length === 1 &&
                        Number(ev.conceptions[0].dadId) === A_SNAIL_ID &&
                        Number(ev.conceptions[0].mumId) === B_SNAIL_ID &&
                        Number(ev.conceptions[0].generation) === 1
                }
                if (!expectMateBFertilised1 && !expectMateAFertilised1) {
                    console.log("\tBreed 1: No conceptions")
                    return ev.conceptions.length === 0 
                }
                else {
                    assert.deepStrictEqual(
                        true,
                        false, 
                        `1 Coding Error: Should not be possible to reach this assert!`
                    )
                }
            }, "1. Event SnailsMated event has incorrect/unexpected conceptions values!")

            // Breed for 2nd-time
            let txBreedResult2
            await truffleAssert.passes(
                txBreedResult2 = await snailToken.breedToConceiveOnly(
                    A_SNAIL_ID, //mateA                
                    B_SNAIL_ID, //mateB
                    {from: accounts[2]}),
                "Snail owner was unable to breed their snails"
            )

            const fertlisationResult2 = await calcFertilisationTH(txBreedResult2);
            const expectMateAFertilised2 = fertlisationResult2.expectMateAFertilised
            const expectMateBFertilised2 = fertlisationResult2.expectMateBFertilised

            truffleAssert.eventEmitted(txBreedResult2, 'SnailsMated', (ev) => {

                if (expectMateAFertilised2 && expectMateBFertilised2) {
                    console.log("\tBreed 2: 2x conceptions - mates A & B")
                    return ev.conceptions.length === 2 &&
                        Number(ev.conceptions[0].mumId) === A_SNAIL_ID &&
                        Number(ev.conceptions[0].dadId) === B_SNAIL_ID &&
                        Number(ev.conceptions[0].generation) === 1 &&
                        Number(ev.conceptions[1].mumId) === B_SNAIL_ID &&
                        Number(ev.conceptions[1].dadId) === A_SNAIL_ID &&
                        Number(ev.conceptions[1].generation) === 1
                }
                if (expectMateAFertilised2 && !expectMateBFertilised2) {
                    console.log("\tBreed 2: 1x conceptions - mateA only")
                    return ev.conceptions.length === 1 &&
                        Number(ev.conceptions[0].mumId) === A_SNAIL_ID &&
                        Number(ev.conceptions[0].dadId) === B_SNAIL_ID &&
                        Number(ev.conceptions[0].generation) === 1
                }
                if (expectMateBFertilised2 && !expectMateAFertilised2) {
                    console.log("\tBreed 2: 1x conceptions - mateB only")
                    return ev.conceptions.length === 1 &&
                        Number(ev.conceptions[0].dadId) === A_SNAIL_ID &&
                        Number(ev.conceptions[0].mumId) === B_SNAIL_ID &&
                        Number(ev.conceptions[0].generation) === 1
                }
                if (!expectMateBFertilised2 && !expectMateAFertilised2) {
                    console.log("\tBreed 2: No conceptions")
                    return ev.conceptions.length === 0 
                }
                else {
                    assert.deepStrictEqual(
                        true,
                        false, 
                        `2 Coding Error: Should not be possible to reach this assert!`
                    )
                }
            }, "2. Event SnailsMated event has incorrect/unexpected conceptions values!")

            // Breed for 3rd-time
            let txBreedResult3
            await truffleAssert.passes(
                txBreedResult3 = await snailToken.breedToConceiveOnly(
                    A_SNAIL_ID, //mateA                
                    B_SNAIL_ID, //mateB
                    {from: accounts[2]}),
                "Snail owner was unable to breed their snails"
            )

            const fertlisationResult3 = await calcFertilisationTH(txBreedResult3);
            const expectMateAFertilised3 = fertlisationResult3.expectMateAFertilised
            const expectMateBFertilised3 = fertlisationResult3.expectMateBFertilised

            truffleAssert.eventEmitted(txBreedResult3, 'SnailsMated', (ev) => {

                if (expectMateAFertilised3 && expectMateBFertilised3) {
                    console.log("\tBreed 3: 2x conceptions - mates A & B")
                    return ev.conceptions.length === 2 &&
                        Number(ev.conceptions[0].mumId) === A_SNAIL_ID &&
                        Number(ev.conceptions[0].dadId) === B_SNAIL_ID &&
                        Number(ev.conceptions[0].generation) === 1 &&
                        Number(ev.conceptions[1].mumId) === B_SNAIL_ID &&
                        Number(ev.conceptions[1].dadId) === A_SNAIL_ID &&
                        Number(ev.conceptions[1].generation) === 1
                }
                if (expectMateAFertilised3 && !expectMateBFertilised3) {
                    console.log("\tBreed 3: 1x conceptions - mateA only")
                    return ev.conceptions.length === 1 &&
                        Number(ev.conceptions[0].mumId) === A_SNAIL_ID &&
                        Number(ev.conceptions[0].dadId) === B_SNAIL_ID &&
                        Number(ev.conceptions[0].generation) === 1
                }
                if (expectMateBFertilised3 && !expectMateAFertilised3) {
                    console.log("\tBreed 3: 1x conceptions - mateB only")
                    return ev.conceptions.length === 1 &&
                        Number(ev.conceptions[0].dadId) === A_SNAIL_ID &&
                        Number(ev.conceptions[0].mumId) === B_SNAIL_ID &&
                        Number(ev.conceptions[0].generation) === 1
                }
                if (!expectMateBFertilised3 && !expectMateAFertilised3) {
                    console.log("\tBreed 3: No conceptions")
                    return ev.conceptions.length === 0 
                }
                else {
                    assert.deepStrictEqual(
                        true,
                        false, 
                        `3 Coding Error: Should not be possible to reach this assert!`
                    )
                }
            }, "3. Event SnailsMated event has incorrect/unexpected conceptions values!")       
        })
    })


    describe("Snail breedToConceiveOnly: Pausing  & Unpausing the SnailToken Contract", () => {

        let snapshotId
        beforeEach("Save Initial Setup State (of blockchain)", async() => {
            let snapshot = await timeMachine.takeSnapshot()
            snapshotId = snapshot['result']
        })

        afterEach("Restore To Initial Setup State (of blockchain)", async() => {
            await timeMachine.revertToSnapshot(snapshotId)
        })

        it("should NOT breedToConceiveOnly when SnailToken contract is in 'paused' state", async () => {

            // Put contract into 'paused' state
            await truffleAssert.passes(
                snailToken.pause(),
                "Failed to put snailToken contract into 'paused' state!"
            )
            await truffleAssert.reverts(
                snailToken.breedToConceiveOnly(
                    A_SNAIL_ID, //mateA
                    B_SNAIL_ID, //mateB
                    {from: accounts[2]}
                ),
                "Pausable: paused"
            )
        })

        it("should allow breedToConceiveOnly after 'paused' SnailToken contract is 'unpaused'", async () => {

            // Put contract into 'paused' state
            await truffleAssert.passes(
                snailToken.pause(),
                "Failed to put snailToken contract into 'paused' state!"
            )
            // Put contract back into 'unpaused' state
            await truffleAssert.passes(
                snailToken.unpause(),
                "Failed to put snailToken contract into 'unpaused' state!"
            )
            await truffleAssert.passes(
                snailToken.breedToConceiveOnly(
                    A_SNAIL_ID, //mateA
                    B_SNAIL_ID, //mateB
                    {from: accounts[2]}
                ),
                "Snail owner was unable to breed their snails"
            )
        })
    })
})