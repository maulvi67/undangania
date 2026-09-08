import {z} from "zod";
export const invitationViewModel=z.object({schemaVersion:z.literal(1),locale:z.string(),timezone:z.string(),couple:z.object({displayNames:z.string()}),events:z.array(z.object({id:z.string(),title:z.string(),startsAt:z.string(),venueName:z.string()})),sections:z.array(z.object({id:z.string(),type:z.string(),visible:z.boolean(),payload:z.unknown()}))});
