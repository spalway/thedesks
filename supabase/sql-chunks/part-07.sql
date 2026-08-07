-- =========================================================================
-- xNFTs database setup — PART 07 of 08
-- =========================================================================
--
-- Run these IN ORDER, one at a time, in the Supabase SQL Editor.
-- Wait for each to finish before starting the next.
--
-- Split only at statement boundaries, so no statement is cut in half. Safe to
-- re-run: every statement uses "if not exists", "or replace", or
-- "on conflict do nothing".
--
-- After all 08 parts, run RUN-THIS-SECOND.sql (protocol_config).
-- =========================================================================

-- =========================================================================
-- SECTION 9 of 16 — 20260806090400_seed_xployee_skills.sql
-- =========================================================================

-- xNFTs index — seed: which desks each xployee works.
--
-- 7,900 rows: 3,000 UNCOMMON x 1 + 1,250 RARE x 2 + 600 EPIC x 3 + 150 X-RATED
-- x 4. Emitted from the same `buildXployee` call that produced 20260806090300,
-- so the skill draw and the apy in that file came out of one roll rather than
-- two.
--
-- Columns: (xployee_id, slot, skill_id, proficiency_pct). `slot` is the draw
-- order — `pickDistinct` returns skills in the order it chose them and the
-- xployee sheet lists them that way, so the order is data rather than
-- presentation.

insert into public.xployee_skills (xployee_id, slot, skill_id, proficiency_pct) values
(4179,0,'silicon',61),
(4180,0,'rails',66),
(4181,0,'bills',68),
(4182,0,'brand',99),
(4183,0,'crude',81),
(4184,0,'claims',73),
(4185,0,'bills',68),
(4186,0,'cloud',87),
(4187,0,'ballast',86),
(4188,0,'trial',62),
(4189,0,'shelf',60),
(4190,0,'silicon',67),
(4191,0,'claims',61),
(4192,0,'cloud',86),
(4193,0,'grid',78),
(4194,0,'bills',86),
(4195,0,'shelf',72),
(4196,0,'brand',100),
(4197,0,'shelf',97),
(4198,0,'bills',97),
(4199,0,'brand',67),
(4200,0,'vault',82),
(4201,0,'trial',77),
(4202,0,'ledger',87),
(4203,0,'brand',88),
(4204,0,'brand',94),
(4205,0,'brand',84),
(4206,0,'silicon',90),
(4207,0,'vault',64),
(4208,0,'crude',77),
(4209,0,'degen',72),
(4210,0,'platform',72),
(4211,0,'brand',73),
(4212,0,'shelf',63),
(4213,0,'crude',78),
(4214,0,'claims',88),
(4215,0,'cloud',70),
(4216,0,'bills',96),
(4217,0,'grid',93),
(4218,0,'cloud',68),
(4219,0,'trial',80),
(4220,0,'ledger',83),
(4221,0,'shelf',89),
(4222,0,'cloud',67),
(4223,0,'vault',90),
(4224,0,'platform',66),
(4225,0,'silicon',74),
(4226,0,'shelf',69),
(4227,0,'trial',64),
(4228,0,'shelf',68),
(4229,0,'bills',67),
(4230,0,'ledger',89),
(4231,0,'teller',88),
(4232,0,'bills',93),
(4233,0,'claims',67),
(4234,0,'claims',79),
(4235,0,'grid',80),
(4236,0,'shelf',74),
(4237,0,'brand',92),
(4238,0,'shelf',84),
(4239,0,'platform',100),
(4240,0,'platform',67),
(4241,0,'grid',83),
(4242,0,'brand',79),
(4243,0,'ballast',90),
(4244,0,'shelf',96),
(4245,0,'grid',84),
(4246,0,'rails',92),
(4247,0,'cloud',67),
(4248,0,'ballast',68),
(4249,0,'shelf',63),
(4250,0,'ballast',68),
(4251,0,'grid',74),
(4252,0,'crude',79),
(4253,0,'claims',91),
(4254,0,'crude',95),
(4255,0,'claims',94),
(4256,0,'bills',70),
(4257,0,'brand',63),
(4258,0,'silicon',90),
(4259,0,'brand',76),
(4260,0,'grid',73),
(4261,0,'brand',88),
(4262,0,'vault',96),
(4263,0,'ballast',88),
(4264,0,'crude',95),
(4265,0,'claims',72),
(4266,0,'ballast',60),
(4267,0,'cloud',77),
(4268,0,'ballast',94),
(4269,0,'trial',65),
(4270,0,'trial',80),
(4271,0,'claims',86),
(4272,0,'silicon',88),
(4273,0,'crude',70),
(4274,0,'rails',84),
(4275,0,'brand',93),
(4276,0,'brand',61),
(4277,0,'ballast',82),
(4278,0,'cloud',100),
(4279,0,'bills',94),
(4280,0,'platform',92),
(4281,0,'rails',69),
(4282,0,'cloud',79),
(4283,0,'degen',69),
(4284,0,'trial',78),
(4285,0,'platform',76),
(4286,0,'cloud',67),
(4287,0,'cloud',70),
(4288,0,'shelf',65),
(4289,0,'brand',64),
(4290,0,'ledger',69),
(4291,0,'trial',70),
(4292,0,'ballast',75),
(4293,0,'vault',94),
(4294,0,'teller',81),
(4295,0,'shelf',83),
(4296,0,'vault',100),
(4297,0,'bills',77),
(4298,0,'vault',75),
(4299,0,'grid',86),
(4300,0,'rails',76),
(4301,0,'silicon',75),
(4302,0,'bills',93),
(4303,0,'brand',75),
(4304,0,'grid',78),
(4305,0,'teller',77),
(4306,0,'shelf',89),
(4307,0,'rails',94),
(4308,0,'rails',62),
(4309,0,'ledger',89),
(4310,0,'brand',80),
(4311,0,'vault',88),
(4312,0,'silicon',96),
(4313,0,'shelf',69),
(4314,0,'ballast',81),
(4315,0,'bills',96),
(4316,0,'vault',96),
(4317,0,'vault',100),
(4318,0,'silicon',99),
(4319,0,'shelf',89),
(4320,0,'platform',97),
(4321,0,'crude',90),
(4322,0,'shelf',78),
(4323,0,'rails',92),
(4324,0,'claims',64),
(4325,0,'ledger',85),
(4326,0,'claims',61),
(4327,0,'ballast',91),
(4328,0,'bills',84),
(4329,0,'grid',93),
(4330,0,'ballast',94),
(4331,0,'ballast',62),
(4332,0,'bills',61),
(4333,0,'bills',66),
(4334,0,'degen',85),
(4335,0,'bills',75),
(4336,0,'ballast',84),
(4337,0,'ledger',69),
(4338,0,'bills',93),
(4339,0,'ledger',73),
(4340,0,'ledger',72),
(4341,0,'bills',68),
(4342,0,'teller',94),
(4343,0,'ledger',97),
(4344,0,'shelf',75),
(4345,0,'trial',64),
(4346,0,'brand',75),
(4347,0,'bills',75),
(4348,0,'brand',86),
(4349,0,'bills',60),
(4350,0,'ballast',60),
(4351,0,'vault',70),
(4352,0,'shelf',65),
(4353,0,'ledger',73),
(4354,0,'shelf',64),
(4355,0,'bills',80),
(4356,0,'claims',83),
(4357,0,'ledger',74),
(4358,0,'shelf',86),
(4359,0,'shelf',71),
(4360,0,'vault',87),
(4361,0,'brand',77),
(4362,0,'vault',61),
(4363,0,'ledger',68),
(4364,0,'rails',73),
(4365,0,'vault',60),
(4366,0,'vault',99),
(4367,0,'ledger',65),
(4368,0,'brand',73),
(4369,0,'rails',89),
(4370,0,'grid',78),
(4371,0,'rails',88),
(4372,0,'ballast',92),
(4373,0,'claims',79),
(4374,0,'crude',65),
(4375,0,'vault',89),
(4376,0,'claims',63),
(4377,0,'bills',85),
(4378,0,'brand',89),
(4379,0,'bills',63),
(4380,0,'teller',90),
(4381,0,'shelf',89),
(4382,0,'trial',96),
(4383,0,'cloud',87),
(4384,0,'brand',98),
(4385,0,'ledger',67),
(4386,0,'platform',65),
(4387,0,'claims',85),
(4388,0,'vault',99),
(4389,0,'crude',95),
(4390,0,'silicon',62),
(4391,0,'brand',99),
(4392,0,'vault',96),
(4393,0,'vault',91),
(4394,0,'rails',84),
(4395,0,'brand',97),
(4396,0,'vault',97),
(4397,0,'platform',76),
(4398,0,'ballast',65),
(4399,0,'shelf',63),
(4400,0,'vault',91),
(4401,0,'bills',98),
(4402,0,'cloud',83),
(4403,0,'ledger',63),
(4404,0,'rails',89),
(4405,0,'ballast',89),
(4406,0,'bills',92),
(4407,0,'cloud',92),
(4408,0,'vault',88),
(4409,0,'platform',95),
(4410,0,'ballast',73),
(4411,0,'shelf',63),
(4412,0,'silicon',89),
(4413,0,'grid',82),
(4414,0,'trial',63),
(4415,0,'ballast',92),
(4416,0,'vault',89),
(4417,0,'crude',99),
(4418,0,'ledger',72),
(4419,0,'claims',83),
(4420,0,'trial',71),
(4421,0,'grid',80),
(4422,0,'bills',61),
(4423,0,'shelf',67),
(4424,0,'rails',64),
(4425,0,'trial',62),
(4426,0,'ballast',81),
(4427,0,'shelf',88),
(4428,0,'bills',62),
(4429,0,'crude',80),
(4430,0,'brand',62),
(4431,0,'shelf',63),
(4432,0,'silicon',90),
(4433,0,'claims',91),
(4434,0,'rails',96),
(4435,0,'vault',94),
(4436,0,'cloud',97),
(4437,0,'rails',67),
(4438,0,'platform',65),
(4439,0,'cloud',80),
(4440,0,'ballast',76),
(4441,0,'bills',88),
(4442,0,'rails',90),
(4443,0,'shelf',84),
(4444,0,'claims',94),
(4445,0,'grid',80),
(4446,0,'bills',68),
(4447,0,'brand',96),
(4448,0,'vault',79),
(4449,0,'vault',74),
(4450,0,'ballast',96),
(4451,0,'teller',67),
(4452,0,'cloud',65),
(4453,0,'claims',72),
(4454,0,'claims',68),
(4455,0,'bills',82),
(4456,0,'rails',72),
(4457,0,'vault',74),
(4458,0,'shelf',64),
(4459,0,'crude',67),
(4460,0,'crude',71),
(4461,0,'rails',87),
(4462,0,'ballast',70),
(4463,0,'rails',82),
(4464,0,'bills',79),
(4465,0,'platform',87),
(4466,0,'platform',94),
(4467,0,'ballast',60),
(4468,0,'bills',82),
(4469,0,'claims',80),
(4470,0,'degen',98),
(4471,0,'platform',75),
(4472,0,'claims',77),
(4473,0,'platform',94),
(4474,0,'ballast',74),
(4475,0,'trial',77),
(4476,0,'ledger',78),
(4477,0,'silicon',68),
(4478,0,'brand',99),
(4479,0,'crude',60),
(4480,0,'cloud',92),
(4481,0,'ballast',82),
(4482,0,'rails',81),
(4483,0,'ledger',85),
(4484,0,'ledger',67),
(4485,0,'vault',99),
(4486,0,'cloud',99),
(4487,0,'platform',61),
(4488,0,'trial',100),
(4489,0,'ballast',92),
(4490,0,'bills',92),
(4491,0,'bills',73),
(4492,0,'rails',75),
(4493,0,'platform',90),
(4494,0,'cloud',100),
(4495,0,'silicon',60),
(4496,0,'shelf',96),
(4497,0,'ledger',79),
(4498,0,'shelf',92),
(4499,0,'shelf',70),
(4500,0,'bills',78),
(4501,0,'crude',89),
(4502,0,'trial',68),
(4503,0,'bills',84),
(4504,0,'grid',83),
(4505,0,'claims',90),
(4506,0,'ledger',79),
(4507,0,'cloud',87),
(4508,0,'vault',80),
(4509,0,'grid',88),
(4510,0,'ballast',74),
(4511,0,'bills',76),
(4512,0,'brand',68),
(4513,0,'grid',72),
(4514,0,'vault',76),
(4515,0,'brand',74),
(4516,0,'vault',94),
(4517,0,'claims',91),
(4518,0,'ballast',84),
(4519,0,'ballast',85),
(4520,0,'cloud',92),
(4521,0,'bills',83),
(4522,0,'claims',91),
(4523,0,'claims',77),
(4524,0,'grid',96),
(4525,0,'trial',80),
(4526,0,'brand',95),
(4527,0,'claims',97),
(4528,0,'grid',72),
(4529,0,'platform',68),
(4530,0,'ballast',83),
(4531,0,'grid',95),
(4532,0,'rails',100),
(4533,0,'silicon',89),
(4534,0,'crude',62),
(4535,0,'brand',77),
(4536,0,'shelf',88),
(4537,0,'shelf',70),
(4538,0,'shelf',69),
(4539,0,'shelf',79),
(4540,0,'shelf',72),
(4541,0,'ballast',95),
(4542,0,'claims',68),
(4543,0,'rails',100),
(4544,0,'grid',78),
(4545,0,'claims',75),
(4546,0,'crude',92),
(4547,0,'brand',82),
(4548,0,'shelf',71),
(4549,0,'vault',73),
(4550,0,'shelf',77),
(4551,0,'vault',91),
(4552,0,'cloud',81),
(4553,0,'grid',68),
(4554,0,'ledger',88),
(4555,0,'ledger',87),
(4556,0,'grid',63),
(4557,0,'bills',97),
(4558,0,'silicon',74),
(4559,0,'cloud',81),
(4560,0,'claims',96),
(4561,0,'ledger',77),
(4562,0,'trial',74),
(4563,0,'trial',89),
(4564,0,'rails',61),
(4565,0,'brand',84),
(4566,0,'shelf',96),
(4567,0,'trial',70),
(4568,0,'bills',92),
(4569,0,'trial',72),
(4570,0,'brand',67),
(4571,0,'platform',74),
(4572,0,'ledger',71),
(4573,0,'bills',62),
(4574,0,'vault',97),
(4575,0,'brand',83),
(4576,0,'grid',79),
(4577,0,'vault',90),
(4578,0,'vault',78),
(4579,0,'ballast',80),
(4580,0,'bills',88),
(4581,0,'ballast',92),
(4582,0,'crude',78),
(4583,0,'silicon',90),
(4584,0,'vault',63),
(4585,0,'bills',64),
(4586,0,'brand',68),
(4587,0,'cloud',82),
(4588,0,'platform',66),
(4589,0,'silicon',69),
(4590,0,'vault',93),
(4591,0,'bills',66),
(4592,0,'ballast',68),
(4593,0,'ledger',82),
(4594,0,'vault',99),
(4595,0,'ledger',90),
(4596,0,'grid',92),
(4597,0,'trial',92),
(4598,0,'cloud',70),
(4599,0,'trial',90),
(4600,0,'platform',81),
(4601,0,'grid',85),
(4602,0,'shelf',66),
(4603,0,'bills',79),
(4604,0,'grid',92),
(4605,0,'bills',63),
(4606,0,'shelf',67),
(4607,0,'platform',75),
(4608,0,'vault',100),
(4609,0,'trial',94),
(4610,0,'platform',73),
(4611,0,'ballast',71),
(4612,0,'bills',87),
(4613,0,'shelf',82),
(4614,0,'claims',96),
(4615,0,'trial',75),
(4616,0,'silicon',62),
(4617,0,'vault',61),
(4618,0,'brand',77),
(4619,0,'brand',86),
(4620,0,'silicon',66),
(4621,0,'brand',97),
(4622,0,'cloud',80),
(4623,0,'trial',75),
(4624,0,'grid',87),
(4625,0,'shelf',72),
(4626,0,'rails',89),
(4627,0,'rails',87),
(4628,0,'bills',87),
(4629,0,'platform',70),
(4630,0,'platform',93),
(4631,0,'bills',65),
(4632,0,'brand',69),
(4633,0,'shelf',87),
(4634,0,'vault',61),
(4635,0,'silicon',69),
(4636,0,'ballast',68),
(4637,0,'shelf',78),
(4638,0,'bills',91),
(4639,0,'ballast',96),
(4640,0,'platform',90),
(4641,0,'ballast',63),
(4642,0,'ledger',99),
(4643,0,'ballast',92),
(4644,0,'rails',88),
(4645,0,'cloud',98),
(4646,0,'trial',77),
(4647,0,'bills',91),
(4648,0,'trial',85),
(4649,0,'trial',77),
(4650,0,'rails',84),
(4651,0,'silicon',88),
(4652,0,'vault',80),
(4653,0,'shelf',69),
(4654,0,'platform',98),
(4655,0,'vault',77),
(4656,0,'shelf',96),
(4657,0,'grid',73),
(4658,0,'rails',72),
(4659,0,'cloud',97),
(4660,0,'grid',82),
(4661,0,'cloud',93),
(4662,0,'brand',92),
(4663,0,'rails',77),
(4664,0,'ledger',82),
(4665,0,'vault',69),
(4666,0,'vault',83),
(4667,0,'ballast',98),
(4668,0,'bills',62),
(4669,0,'ballast',67),
(4670,0,'silicon',77),
(4671,0,'ballast',94),
(4672,0,'rails',76),
(4673,0,'degen',71),
(4674,0,'platform',91),
(4675,0,'cloud',60),
(4676,0,'ballast',96),
(4677,0,'ballast',71),
(4678,0,'trial',61),
(4679,0,'ledger',95),
(4680,0,'rails',67),
(4681,0,'rails',73),
(4682,0,'vault',99),
(4683,0,'crude',95),
(4684,0,'platform',67),
(4685,0,'crude',67),
(4686,0,'crude',87),
(4687,0,'crude',72),
(4688,0,'shelf',66),
(4689,0,'platform',95),
(4690,0,'shelf',78),
(4691,0,'claims',62),
(4692,0,'bills',78),
(4693,0,'bills',92),
(4694,0,'vault',81),
(4695,0,'vault',79),
(4696,0,'vault',99),
(4697,0,'brand',92),
(4698,0,'bills',61),
(4699,0,'trial',86),
(4700,0,'ballast',92),
(4701,0,'bills',79),
(4702,0,'bills',98),
(4703,0,'brand',75),
(4704,0,'bills',84),
(4705,0,'ballast',87),
(4706,0,'ballast',62),
(4707,0,'vault',67),
(4708,0,'ledger',79),
(4709,0,'ballast',83),
(4710,0,'ledger',95),
(4711,0,'ledger',88),
(4712,0,'trial',98),
(4713,0,'crude',90),
(4714,0,'rails',97),
(4715,0,'ballast',80),
(4716,0,'brand',91),
(4717,0,'vault',96),
(4718,0,'brand',74),
(4719,0,'crude',72),
(4720,0,'bills',83),
(4721,0,'ballast',67),
(4722,0,'brand',84),
(4723,0,'trial',62),
(4724,0,'shelf',63),
(4725,0,'crude',65),
(4726,0,'trial',84),
(4727,0,'brand',62),
(4728,0,'ballast',60),
(4729,0,'claims',68),
(4730,0,'shelf',78),
(4731,0,'brand',83),
(4732,0,'shelf',92),
(4733,0,'grid',92),
(4734,0,'ballast',89),
(4735,0,'bills',80),
(4736,0,'shelf',89),
(4737,0,'ballast',64),
(4738,0,'ballast',71),
(4739,0,'ledger',95),
(4740,0,'bills',66),
(4741,0,'grid',72),
(4742,0,'shelf',71),
(4743,0,'bills',74),
(4744,0,'ballast',98),
(4745,0,'shelf',79),
(4746,0,'vault',70),
(4747,0,'claims',74),
(4748,0,'vault',80),
(4749,0,'ledger',82),
(4750,0,'ballast',61),
(4751,0,'vault',87),
(4752,0,'crude',98),
(4753,0,'rails',83),
(4754,0,'crude',66),
(4755,0,'grid',66),
(4756,0,'cloud',98),
(4757,0,'trial',92),
(4758,0,'shelf',97),
(4759,0,'grid',65),
(4760,0,'shelf',64),
(4761,0,'ledger',82),
(4762,0,'ballast',96),
(4763,0,'crude',75),
(4764,0,'vault',68),
(4765,0,'grid',78),
(4766,0,'cloud',74),
(4767,0,'shelf',82),
(4768,0,'bills',96),
(4769,0,'crude',81),
(4770,0,'vault',87),
(4771,0,'rails',79),
(4772,0,'ballast',65),
(4773,0,'vault',100),
(4774,0,'cloud',99),
(4775,0,'grid',99),
(4776,0,'ballast',81),
(4777,0,'teller',99),
(4778,0,'grid',99),
(4779,0,'grid',95),
(4780,0,'vault',99),
(4781,0,'bills',79),
(4782,0,'teller',64),
(4783,0,'bills',97),
(4784,0,'bills',64),
(4785,0,'vault',73),
(4786,0,'ballast',63),
(4787,0,'brand',81),
(4788,0,'brand',63),
(4789,0,'platform',83),
(4790,0,'grid',73),
(4791,0,'rails',61),
(4792,0,'cloud',100),
(4793,0,'ledger',89),
(4794,0,'claims',65),
(4795,0,'vault',75),
(4796,0,'claims',78),
(4797,0,'vault',69),
(4798,0,'platform',61),
(4799,0,'platform',65),
(4800,0,'silicon',99),
(4801,0,'ballast',68),
(4802,0,'silicon',74),
(4803,0,'rails',87),
(4804,0,'claims',76),
(4805,0,'ballast',70),
(4806,0,'ballast',66),
(4807,0,'cloud',91),
(4808,0,'crude',72),
(4809,0,'rails',95),
(4810,0,'grid',80),
(4811,0,'rails',94),
(4812,0,'shelf',97),
(4813,0,'platform',87),
(4814,0,'bills',96),
(4815,0,'bills',69),
(4816,0,'claims',92),
(4817,0,'platform',89),
(4818,0,'trial',79),
(4819,0,'crude',73),
(4820,0,'teller',63),
(4821,0,'shelf',89),
(4822,0,'ballast',67),
(4823,0,'ballast',86),
(4824,0,'rails',67),
(4825,0,'crude',96),
(4826,0,'platform',83),
(4827,0,'bills',100),
(4828,0,'crude',79),
(4829,0,'ledger',83),
(4830,0,'silicon',61),
(4831,0,'ballast',64),
(4832,0,'claims',71),
(4833,0,'ledger',74),
(4834,0,'rails',89),
(4835,0,'platform',96),
(4836,0,'crude',83),
(4837,0,'cloud',85),
(4838,0,'brand',97),
(4839,0,'rails',97),
(4840,0,'cloud',72),
(4841,0,'ballast',96),
(4842,0,'ballast',73),
(4843,0,'crude',80),
(4844,0,'silicon',72),
(4845,0,'teller',89),
(4846,0,'silicon',77),
(4847,0,'brand',69),
(4848,0,'ballast',100),
(4849,0,'trial',61),
(4850,0,'rails',67),
(4851,0,'shelf',83),
(4852,0,'ledger',87),
(4853,0,'cloud',85),
(4854,0,'brand',63),
(4855,0,'shelf',79),
(4856,0,'vault',78),
(4857,0,'platform',77),
(4858,0,'degen',71),
(4859,0,'grid',85),
(4860,0,'ledger',82),
(4861,0,'bills',84),
(4862,0,'claims',85),
(4863,0,'ballast',90),
(4864,0,'trial',100),
(4865,0,'brand',70),
(4866,0,'claims',84),
(4867,0,'cloud',70),
(4868,0,'grid',95),
(4869,0,'silicon',61),
(4870,0,'crude',76),
(4871,0,'shelf',95),
(4872,0,'bills',76),
(4873,0,'cloud',95),
(4874,0,'degen',68),
(4875,0,'shelf',60),
(4876,0,'vault',93),
(4877,0,'shelf',70),
(4878,0,'platform',63),
(4879,0,'teller',90),
(4880,0,'platform',87),
(4881,0,'ledger',100),
(4882,0,'ballast',88),
(4883,0,'crude',94),
(4884,0,'shelf',96),
(4885,0,'crude',100),
(4886,0,'cloud',78),
(4887,0,'brand',68),
(4888,0,'ballast',98),
(4889,0,'silicon',63),
(4890,0,'cloud',73),
(4891,0,'grid',80),
(4892,0,'ballast',84),
(4893,0,'bills',89),
(4894,0,'ballast',71),
(4895,0,'vault',64),
(4896,0,'grid',89),
(4897,0,'brand',84),
(4898,0,'trial',68),
(4899,0,'shelf',68),
(4900,0,'silicon',97),
(4901,0,'bills',77),
(4902,0,'grid',100),
(4903,0,'cloud',84),
(4904,0,'crude',73),
(4905,0,'crude',89),
(4906,0,'ledger',82),
(4907,0,'claims',68),
(4908,0,'shelf',63),
(4909,0,'claims',73),
(4910,0,'crude',86),
(4911,0,'rails',84),
(4912,0,'grid',73),
(4913,0,'trial',89),
(4914,0,'crude',66),
(4915,0,'shelf',77),
(4916,0,'platform',77),
(4917,0,'teller',70),
(4918,0,'platform',87),
(4919,0,'shelf',96),
(4920,0,'shelf',65),
(4921,0,'vault',70),
(4922,0,'bills',66),
(4923,0,'shelf',73),
(4924,0,'bills',71),
(4925,0,'ledger',76),
(4926,0,'shelf',97),
(4927,0,'ballast',98),
(4928,0,'grid',96),
(4929,0,'bills',90),
(4930,0,'rails',77),
(4931,0,'claims',92),
(4932,0,'cloud',73),
(4933,0,'ballast',60),
(4934,0,'cloud',98),
(4935,0,'platform',100),
(4936,0,'brand',95),
(4937,0,'ballast',89),
(4938,0,'rails',100),
(4939,0,'rails',68),
(4940,0,'cloud',95),
(4941,0,'platform',88),
(4942,0,'rails',78),
(4943,0,'grid',62),
(4944,0,'ballast',86),
(4945,0,'vault',72),
(4946,0,'silicon',81),
(4947,0,'platform',85),
(4948,0,'cloud',86),
(4949,0,'ballast',79),
(4950,0,'claims',93),
(4951,0,'ballast',84),
(4952,0,'shelf',84),
(4953,0,'bills',69),
(4954,0,'shelf',64),
(4955,0,'cloud',71),
(4956,0,'teller',98),
(4957,0,'teller',86),
(4958,0,'claims',92),
(4959,0,'ballast',64),
(4960,0,'shelf',76),
(4961,0,'shelf',91),
(4962,0,'shelf',98),
(4963,0,'ballast',94),
(4964,0,'vault',84),
(4965,0,'vault',68),
(4966,0,'cloud',73),
(4967,0,'platform',71),
(4968,0,'rails',89),
(4969,0,'shelf',81),
(4970,0,'grid',79),
(4971,0,'bills',83),
(4972,0,'platform',82),
(4973,0,'claims',92),
(4974,0,'platform',75),
(4975,0,'shelf',82),
(4976,0,'trial',73),
(4977,0,'trial',82),
(4978,0,'brand',96),
(4979,0,'ledger',79),
(4980,0,'ballast',83),
(4981,0,'grid',96),
(4982,0,'vault',95),
(4983,0,'brand',96),
(4984,0,'brand',70),
(4985,0,'ledger',85),
(4986,0,'degen',74),
(4987,0,'ledger',69),
(4988,0,'ledger',78),
(4989,0,'rails',97),
(4990,0,'platform',64),
(4991,0,'ledger',64),
(4992,0,'vault',75),
(4993,0,'ledger',70),
(4994,0,'silicon',96),
(4995,0,'cloud',86),
(4996,0,'cloud',76),
(4997,0,'cloud',87),
(4998,0,'trial',89),
(4999,0,'ballast',91);


-- ---------------------------------------------------------------------------
-- THE APY RECONCILIATION
-- ---------------------------------------------------------------------------
--
-- `blendedApy` is the MEAN of a worker's effective rates — deliberately a mean
-- and not a sum, because more skills means more desks and more diversification
-- rather than a flat multiple of the yield. This block recomputes that mean in
-- exact decimal arithmetic from the rows above plus public.skills, and compares
-- it to the apy the generator wrote in 20260806090300.
--
-- It is the most valuable assertion in the seed, because it is the only one that
-- cross-checks two independently emitted files against a third table. A skill
-- assigned to the wrong serial shifts a blended rate by whole percentage points;
-- a truncated skills file leaves a worker short a desk and drops its mean. Both
-- are invisible to a row count and neither survives this.
--
-- The tolerance is one unit in the last stored place. `apy` is numeric(8,6) and
-- the generator rounds a float64 mean into it, so the two can differ by up to
-- half of 1e-6 by construction — the generator measures that drift and refuses to
-- emit if it ever exceeds it. Anything larger than 1e-6 is not rounding.
do $$
declare
  v_rows integer;
  v_bad  integer;
  v_rec  record;
begin
  select count(*) into v_rows from public.xployee_skills;
  if v_rows <> 7900 then
    raise exception 'seeded % skill rows, expected 7900', v_rows;
  end if;

  -- Every worker holds exactly as many skills as its tier says. The primary key
  -- stops a slot being written twice and the unique constraint stops a skill
  -- being held twice; neither can see a worker that is simply short one row.
  select count(*) into v_bad from (
    select x.id
      from public.xployees x
      left join public.xployee_skills xs on xs.xployee_id = x.id
     group by x.id, x.skills
    having count(xs.slot) <> x.skills
  ) d;
  if v_bad > 0 then
    raise exception '% xployees hold the wrong number of skills for their tier', v_bad;
  end if;

  -- Slots are 0..n-1 with no gaps, so "the third skill" means the same thing to
  -- the database and to the sheet that renders it.
  select count(*) into v_bad from (
    select xs.xployee_id
      from public.xployee_skills xs
     group by xs.xployee_id
    having min(xs.slot) <> 0 or max(xs.slot) <> count(*) - 1
  ) d;
  if v_bad > 0 then
    raise exception '% xployees have gaps in their skill slots', v_bad;
  end if;

  for v_rec in
    select x.id,
           x.apy as stored,
           avg(s.base_apy * xs.proficiency_pct / 100) as computed
      from public.xployees x
      join public.xployee_skills xs on xs.xployee_id = x.id
      join public.skills s          on s.id = xs.skill_id
     group by x.id, x.apy
    having abs(x.apy - avg(s.base_apy * xs.proficiency_pct / 100)) > 0.000001
     limit 5
  loop
    raise exception 'xployee % stores apy % but its desks blend to %',
      public.serial_label(v_rec.id), v_rec.stored, round(v_rec.computed, 8);
  end loop;
end;
$$;

-- Now that every worker has its desks, the apy column can stop being nullable.
-- Left open until this point on purpose: a NOT NULL declared before the seed
-- would have to be satisfied by whichever file happened to load first, and the
-- apy is only meaningful once the rows it is the mean of exist.
alter table public.xployees alter column apy set not null;
alter table public.xployees alter column tier set not null;
alter table public.xployees alter column skills set not null;
alter table public.xployees alter column principal set not null;
alter table public.xployees alter column art_seed set not null;

-- A note for anyone reading the migrations in order rather than as one push:
-- `art_seed` becoming NOT NULL breaks the INSERT branch of the ORIGINAL
-- `record_simulated_sale` from 20260805120100, which upserts (id, owner) and
-- supplies no art seed. That branch is unreachable — every serial exists from
-- 20260806090300, so the upsert always takes its UPDATE path — and the function
-- is rewritten in 20260806090800 into an update-only writer that raises on an
-- unknown serial. It also has no caller: nothing in this backend invokes it, by
-- design, because an unauthenticated endpoint that inserts sale rows would let
-- anyone reassign any xployee. The window between these two migrations is inside
-- a single `db push`.

comment on column public.xployees.apy is
  'Blended annual rate: the MEAN of this worker''s effective desk rates. Reconciled against public.xployee_desks at seed time to one unit in the last stored place.';


-- =========================================================================
-- SECTION 10 of 16 — 20260806090500_seed_xnet_genesis.sql
-- =========================================================================

-- xNFTs index — seed: the xNET and the genesis crew.
--
-- 97 deterministic wallets and the 512 xployees they already hold.
--
-- ---------------------------------------------------------------------------
-- WHY SIMULATED OWNERSHIP IS WRITTEN DOWN AT ALL
-- ---------------------------------------------------------------------------
-- `src/lib/network.ts` partitions the first 512 serials across 97 pseudo-wallets
-- by slicing a seeded permutation, and every xNET surface — the leaderboard, a
-- wallet sheet, the social directory, a trade offer naming somebody's units —
-- reads that partition. It is simulated and it stays simulated. What changes here
-- is only WHERE it lives.
--
-- It has to live here because the marketplace is about to become writable. A sale
-- moves `xployees.owner`; a trade offer names units a wallet must actually hold;
-- a listing has to be refused when the seller does not own what they are
-- advertising. Every one of those is a question about ownership, and a question
-- the database cannot answer is a question the database cannot enforce — the
-- server would be checking a claim against nothing, which is the same as not
-- checking it. So the partition is seeded, and from here on ownership has exactly
-- one home.
--
-- The 512 are marked `claim_kind = 'genesis'` in the reveal order rather than
-- 'minted', and the distinction is load-bearing: nobody burned for them, no
-- signature exists, and `public.mints` stays empty until a real transaction is
-- indexed. A reader asking "how many xployees have been minted" counts mints, not
-- owners.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES TO THE MINT POOL
-- ---------------------------------------------------------------------------
-- Claiming positions 0..511 is what stops a real mint being dealt a serial the
-- app is already rendering as somebody else's. `useHoldings.hire()` draws from
-- `serialForMint(HIRED_COUNT + n)` for exactly this reason; the dealer in
-- 20260806090500 gets the same behaviour for free by taking the lowest position
-- still in the pool, which after this file is 512.
--
-- Hire times come from `hireTimeFor(position)` — seeded on mint position, not on
-- the clock — so they are stable across machines and across re-runs of the
-- generator. Accrual is a pure function of (hired_at, now), so seeding the hire
-- time is what makes a book value computed in Postgres agree with one computed in
-- the browser.

-- The wallet rows first: `xployees.owner` is not a foreign key (a mint must never
-- fail because the buyer has no profile row), but the xNET wallets are known in
-- advance and a directory that can name them is better than one that cannot.
insert into public.wallets (address, handle) values
('2UGbkX5c2DmJ7LhDejmmC4z1DnLEn9DFZ2qZeZowPKYT','lanyardpusher'),
('2eaZ7LmLeeCYC7KD4BLBaDoM5gLFavZB9tBeP5H64Qse','candlebull'),
('36LyTsbPoxuafWNtBvyyJ44iEv6U5Gv1Q2q2pwdRRKZD','mstr_ape'),
('3WrSVq3wACYa3jkbJssjbTqR4C5Emz5JCXABYbJoqGLR','pivotbull52'),
('3cSYcZcYiB8HU7wMVAGRL7StsXt1gXgL3rdV4tsBG1Cd','wickdealer'),
('3ehHTBeunc2tsrUWY9e3RmGiQkpipNKy66c6h9qtTMJ7','fillape'),
('4BKvPBeTAnjSwpe7dpEXZHHNeNqfm6377x2ojmH2mRFE','overtimefund2'),
('4xuZhrBftGYDuMqRU6wGD9jsAKvQxTkdXuraaVQRffqy','v_holder'),
('5DrvsWxE1YWoAbTDj6ZyHM2ouQqRWeppYb341YZb6Hbn','margingoblin62'),
('5mEW6FSZbfg9rV2j6Rgjo3Zr96nh1yzTKetyJBAJTWqR','capital_block'),
('7QJX18yNi2EPhfiT9hT295V2hqA3FQ46zGvm3nM1YGDy','stacker_fill'),
('7jZ8V9chpen3p5waHRAFz8wBEAe5enjqaPHSNmD8bNka','v_runner'),
('8qpBGG6atMZdNqgPNsKrUsydYM7nXqqoVSTdr6j3wy9n','tempprinter95'),
('97C6BD8uKT5UecxptgoWex9TwhPng2BpXgyEbE5mDNFy','mstr_printer'),
('9Bh3WaVoXyWK9sm3fq97JEXrSEQkkF9Xc4WCpM7hQ2Rr','ko_maxi'),
('9SnXcRSFTELMTvtkBU9boqD5ogpspVRkTF3ziGJQoGiM','yielddealer'),
('9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','printbot'),
('9k61cL8f1a8Z1phdMm4B9zGenzkwNouNJLrg8nzgCmTd','swivelmaxi96'),
('BL8GmhJi6WKFHMa6UcmV6UZAxKdaTNcW9Whu1rtJzYrK','filldegen'),
('BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','badgeape'),
('DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','overtimerunner'),
('DWcHzMf1wZ7V9qWfdLp8fiiG2b81AncqwbJUdvTmN1JY','xom_watcher'),
('EJP8o6tCeeLQmLzfJWur2MspXnm1X5PnsiakkNsnci1S','xom_goblin'),
('EUjBYtJvv35BoNFqnZjdteGDEVYHxr7Pr9KfweDJrpjo','sniper_severance'),
('EcUf8HcSwQwEYYzYNmJjRFXKw1d1nZFkWKRbviHASHkB','wireape'),
('F1CLhnLYRivgPFy4ZGaCKPDoD4MqzLexdJdEGfEv5smE','quotaflipper'),
('HYU5649zRdCYRzh2QC5B9ztiobiwUq3LYyHcWRY4e1Th','deskbot'),
('HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','deltaholder'),
('JXh99dYPCupQ4xMPkzFkFCUjWmfYv6RuKJy3NP42H4G1','shiftbull64'),
('JrH65VFWrnmYhyW5ptuiBquyb8RiMqvXuNBe2r3Qo4Bk','yieldwatcher'),
('Ki7sGTgPfaTWWVPhnmSQypacnQqfX36uYk81in7Mmnih','wickape74'),
('KvpN2fpaR9MKxZBeMPNVJ7hecZmPYnkQXEMiS8tGpmNS','mstr_stacker'),
('LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','tapewagie'),
('MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','wickfund88'),
('MQNvSuGofcVPe4hv5TcJHfMTt1qVv2owZ9zBTuf2XBVj','flipper_yield'),
('NAJJEs4C9QRDffTejzyUC9uRByreeK6x7cvMHWtG3mS3','mstr_capital'),
('NTP9d93FTGRFYKgxnYNiZyxN9xM8REjUVKh9kA15GVRz','overtimekeeper'),
('NYQbWWNBQWTR3T29TrDUaJy7MgjLVweCR6B5ouGVuhdj','sweeper_delta'),
('PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','timesheetdegen'),
('Q19hwFNs8PvmjCCdR2fMNjTNTAS5Ckno2xybmn2AQYjm','swivelsweeper'),
('QCRsqhZdAQPaRDXXd9vCTPZm4jBHVJ9opug33K58V9sK','fillwatcher'),
('QDLySA1CJmfeNEB7Bt2ScLYgfuLDm3jp4wGR16SNYyZX','v_grinder'),
('RHjPEJYcYyBiG2EnFeXYq7UMqnNXu3HAJhwzbYYmu5Cv','vaultrunner'),
('RUz37ya9EMZTCDjoVw4YbZpjb8q6YN7HiVrybpX3dzic','hon_chad'),
('RVDVQaj22zGAGpAEyJRrkkiMsd2WymJjDFdG1SCBbJ8q','degen_quota'),
('RmDc8rH9mQkUeS4QXpHFR5Z5Sj5aYcPxwDS6uRCtPjk3','bull_backoffice'),
('SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','shiftprinter'),
('SjFc5xCjunC2GAEsZ7CNhDiAARXBGnTLJghr1W16u6f2','chad_wire'),
('T5bFnyVxgiYPbtZXDUhERGnMBmaX3k5nUXWNJrZj4w2j','baglord_nightshift'),
('TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','vaultfarmer'),
('TVFsuG35TCjWF3q6QkwYqZi1VUW7aLFZcvxERH6GbNPi','cubiclejockey30'),
('ToDTZXWy58HxqPSH64JnR7Buxv9HTQ8V8FdsyrahZSfz','clerkwatcher'),
('UA7w1dZaSabvZrZmbx4k6zm2BuLow9N2cDuvvTP2YpzV','hands_tape'),
('UULKeR8k6j1yGZpa6aBYJo9FNQjQ5xFX78xiEn4RHuya','tbll_capital'),
('VQxbQ3TDHkMygGmtZ3qaNuDfvWQTp2S4h7v9p7J97Tbb','ape_nightshift'),
('WqaAdsEhLfUqEB7JfLi9hmGzJga66TjAwehkutCVugF2','lord_payroll'),
('WvKQKspnYcjfqFidTzxsEZsGyGetgyigMg1yJZ7MbDXL','lly_keeper'),
('XkBCbBs1LTy16L27qxPH2DAGjjNZnYBTZCdGnU2WhKMa','candleholder'),
('YZCjY84F4q1kZ7HNpMoso9mA4sweHmSF2HKeHMs8UBqo','bull_shift'),
('ZL4TWbfCtZUiwEHLH6z1wsFvWAeZ12F9p1FaHeryQYpJ','wickkeeper'),
('ZbNYx3vx4WSXdSCXao7FgSPiETd3b62YFmv3msR3HisA','nightshiftgoblin17'),
('aj5JfbLsdJWwre7RcmNHisAPkvgou9Tu3KPL5F5gRAoN','carrygrinder21'),
('au2Q4HtK7mywVq2XK5MUh1rha7EXcQADMkaMBGC7CYmU','pg_degen'),
('baQ45Ka6oLzGKxxgRRdSE2HbUHd9RkjXT4L5p8irmQuy','couponape36'),
('bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','tbll_farmer'),
('cES5aVzWCozgeT4xPoqg7AsRAcNpsQ459coLeTSkL2L5','gld_holder'),
('cZFSA3twdYjiSYd2WAY82cHv4WG4br4G92AUu5MwzqyS','yieldlord'),
('g66VHjXcbpF7wAwkuMKcRSBWDgpzVW5x5KpXsAMP1dsr','staplerhands99'),
('gUUohZVWwH6GEy8Zr4JV7Y79uPSxmeRt4LzrLZujCsjg','deltakeeper'),
('h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','sniper_nightshift'),
('h85TESphRgjDpFpfgsqWwpoKhVscDeTQjJUoDRc2gh7X','flowholder50'),
('hFpiyPm8UKg5hBdTzXLm94H1QEiZHNNL8nKysw6kPrTN','booksweeper56'),
('jfNeBRxdDEEPN6vf6nDHytr88LcrkqFV3BCwJuAFi9jM','staplersniper94'),
('jjaN7AxhZAXmrvAjrjWQcXinvqtJvVDMFBTAvQSMvEKB','lanyardwhale'),
('k9NHpDyWT7aki8UgXLKkMzSqrEzjXeVJHPdfGyH5a4mV','goblin_block'),
('nABDma8ZFrqrJwDQsrfc1wqXPd1xVRxvvhC5G5QPRBve','payrolllord'),
('nVdrPN1x9sJDws1UwwHXSmSxDen32CfnYpr1svigsQHL','lord_memo'),
('nmoFDY4jxwWi7N5e4zcsTagSjnXQDkevRjMdw65asc1S','ko_bot'),
('osfPt3SoPb3s7PJwR5KvXZ8pTbVtfQXX6Up5bHu2dsL3','unh_bull'),
('p4pRUbkKukN2njr47z9XLFbvVDwQco4kPzBsdXXTxPui','nightshiftmaxi'),
('p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','memostacker'),
('peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','printgoblin22'),
('pwd8Ac7k2hKiMkzBffou3QiSNFMb92kBpq64vFy8jgHo','lanyardgrinder'),
('q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','couponbull18'),
('qVGw6wKZFSmYwPASTiepmVwK9CebepRPtqf8CjQWqUW5','baglord_wick'),
('s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','aapl_pusher'),
('sRMVnGH4joMw6SCMfEwDhEzSQn3F3DkaCwVmTbe8CQEh','fillgoblin47'),
('siFmeoSaRs6MhKCXK56ScZSzLtpT3qXeWweQkYF8dA3c','maxi_nightshift'),
('t4Zx18iZgPCKdSNDVEvrzEiytcxSrSyqGkAusFYyVAeT','yieldkeeper'),
('uQCXFLBWwqMtNjihMyz3pKhjX8Cyk6j1RTkPA5qr4mS4','filldegen35'),
('uisJorf8tmKduAtLkUHcneBfFd28DafQTkf9L2bXU1EV','anon_severance'),
('usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','nvda_hands'),
('vA9ybRpg5mw1UJoa6jNLtvYHksujBg6zh1FdYjH5beV9','carryjockey70'),
('wJTFjs2Wm4R2sejeRCRoYkpPxiEcELeUu9jQhNedevQR','chad_spread'),
('wbuGdkNuQkj7mWiY7h83UNiAZdwpgJn4MhiDG1i2b1iU','auditbull35'),
('wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','lly_bot'),
('z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','yieldrunner6')on conflict (address) do nothing;

-- (draw_position, serial, owner, hired_at) for the 512 the collection ships with.
-- Loaded into a temporary table so the two statements that follow — claim the
-- reveal position, set the ownership — read the same list and cannot disagree
-- about it. The table is `on commit drop`, so it does not survive the migration.
create temporary table genesis_crew (
  draw_position integer primary key,
  serial        integer not null unique,
  owner         text    not null,
  hired_at      timestamptz not null
) on commit drop;

insert into genesis_crew (draw_position, serial, owner, hired_at) values
(0,2867,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-01-06T00:00:00.000Z'::timestamptz),
(1,995,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-01-06T00:00:00.000Z'::timestamptz),
(2,3679,'3WrSVq3wACYa3jkbJssjbTqR4C5Emz5JCXABYbJoqGLR','2026-01-07T22:05:54.594Z'::timestamptz),
(3,3355,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-01-06T12:35:17.756Z'::timestamptz),
(4,1885,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-01-08T23:02:33.562Z'::timestamptz),
(5,62,'UULKeR8k6j1yGZpa6aBYJo9FNQjQ5xFX78xiEn4RHuya','2026-01-08T02:50:26.000Z'::timestamptz),
(6,2967,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-01-08T08:57:29.158Z'::timestamptz),
(7,2234,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-01-09T13:37:38.311Z'::timestamptz),
(8,3928,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-01-10T10:52:51.494Z'::timestamptz),
(9,2227,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-01-07T04:06:23.819Z'::timestamptz),
(10,2638,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-01-11T00:15:06.601Z'::timestamptz),
(11,2007,'SjFc5xCjunC2GAEsZ7CNhDiAARXBGnTLJghr1W16u6f2','2026-01-11T10:58:09.419Z'::timestamptz),
(12,3020,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-01-11T12:33:40.255Z'::timestamptz),
(13,4745,'VQxbQ3TDHkMygGmtZ3qaNuDfvWQTp2S4h7v9p7J97Tbb','2026-01-12T07:50:32.403Z'::timestamptz),
(14,4511,'RmDc8rH9mQkUeS4QXpHFR5Z5Sj5aYcPxwDS6uRCtPjk3','2026-01-09T21:44:46.519Z'::timestamptz),
(15,284,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-01-10T22:32:01.066Z'::timestamptz),
(16,2823,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-01-12T23:42:37.764Z'::timestamptz),
(17,3480,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-01-11T04:58:59.352Z'::timestamptz),
(18,731,'h85TESphRgjDpFpfgsqWwpoKhVscDeTQjJUoDRc2gh7X','2026-01-11T20:53:37.513Z'::timestamptz),
(19,4109,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-01-11T15:07:20.525Z'::timestamptz),
(20,1852,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-01-13T12:00:36.478Z'::timestamptz),
(21,3354,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-01-14T22:11:39.305Z'::timestamptz),
(22,3591,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-01-13T02:45:52.887Z'::timestamptz),
(23,3138,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-01-15T10:35:26.049Z'::timestamptz),
(24,295,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-01-15T06:41:14.178Z'::timestamptz),
(25,2087,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-01-16T00:38:17.746Z'::timestamptz),
(26,3863,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-01-15T09:57:32.393Z'::timestamptz),
(27,1291,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-01-14T18:26:50.122Z'::timestamptz),
(28,2833,'h85TESphRgjDpFpfgsqWwpoKhVscDeTQjJUoDRc2gh7X','2026-01-15T07:13:03.095Z'::timestamptz),
(29,4661,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-01-15T20:42:02.102Z'::timestamptz),
(30,4747,'5DrvsWxE1YWoAbTDj6ZyHM2ouQqRWeppYb341YZb6Hbn','2026-01-17T06:51:54.210Z'::timestamptz),
(31,1289,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-01-15T11:56:36.272Z'::timestamptz),
(32,2012,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-01-19T04:40:48.108Z'::timestamptz),
(33,4749,'4xuZhrBftGYDuMqRU6wGD9jsAKvQxTkdXuraaVQRffqy','2026-01-19T10:23:52.031Z'::timestamptz),
(34,1261,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-01-19T11:30:22.855Z'::timestamptz),
(35,1706,'XkBCbBs1LTy16L27qxPH2DAGjjNZnYBTZCdGnU2WhKMa','2026-01-16T17:01:22.476Z'::timestamptz),
(36,42,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-01-17T11:37:50.373Z'::timestamptz),
(37,3067,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-01-17T18:18:12.351Z'::timestamptz),
(38,3454,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-01-19T08:25:58.726Z'::timestamptz),
(39,1200,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-01-19T03:45:51.700Z'::timestamptz),
(40,4358,'XkBCbBs1LTy16L27qxPH2DAGjjNZnYBTZCdGnU2WhKMa','2026-01-20T20:42:55.977Z'::timestamptz),
(41,786,'wbuGdkNuQkj7mWiY7h83UNiAZdwpgJn4MhiDG1i2b1iU','2026-01-22T03:55:51.730Z'::timestamptz),
(42,2090,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-01-22T08:01:14.065Z'::timestamptz),
(43,4574,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-01-22T15:54:52.667Z'::timestamptz),
(44,3786,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-01-23T03:30:04.717Z'::timestamptz),
(45,3259,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-01-22T16:10:56.297Z'::timestamptz),
(46,4780,'F1CLhnLYRivgPFy4ZGaCKPDoD4MqzLexdJdEGfEv5smE','2026-01-21T19:47:50.322Z'::timestamptz),
(47,1532,'qVGw6wKZFSmYwPASTiepmVwK9CebepRPtqf8CjQWqUW5','2026-01-22T07:40:53.242Z'::timestamptz),
(48,1499,'k9NHpDyWT7aki8UgXLKkMzSqrEzjXeVJHPdfGyH5a4mV','2026-01-22T06:44:17.383Z'::timestamptz),
(49,1080,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-01-23T11:10:10.087Z'::timestamptz),
(50,3838,'aj5JfbLsdJWwre7RcmNHisAPkvgou9Tu3KPL5F5gRAoN','2026-01-22T12:03:26.428Z'::timestamptz),
(51,96,'wJTFjs2Wm4R2sejeRCRoYkpPxiEcELeUu9jQhNedevQR','2026-01-23T21:03:56.163Z'::timestamptz),
(52,394,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-01-23T07:02:47.800Z'::timestamptz),
(53,1949,'NAJJEs4C9QRDffTejzyUC9uRByreeK6x7cvMHWtG3mS3','2026-01-25T17:14:01.548Z'::timestamptz),
(54,2939,'9Bh3WaVoXyWK9sm3fq97JEXrSEQkkF9Xc4WCpM7hQ2Rr','2026-01-23T10:28:37.769Z'::timestamptz),
(55,4354,'hFpiyPm8UKg5hBdTzXLm94H1QEiZHNNL8nKysw6kPrTN','2026-01-26T11:53:09.411Z'::timestamptz),
(56,465,'siFmeoSaRs6MhKCXK56ScZSzLtpT3qXeWweQkYF8dA3c','2026-01-24T00:30:48.510Z'::timestamptz),
(57,768,'TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','2026-01-27T01:51:55.461Z'::timestamptz),
(58,3635,'au2Q4HtK7mywVq2XK5MUh1rha7EXcQADMkaMBGC7CYmU','2026-01-25T07:36:15.680Z'::timestamptz),
(59,1708,'RmDc8rH9mQkUeS4QXpHFR5Z5Sj5aYcPxwDS6uRCtPjk3','2026-01-27T10:25:16.596Z'::timestamptz),
(60,4862,'MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','2026-01-27T23:35:07.465Z'::timestamptz),
(61,4682,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-01-26T01:31:13.990Z'::timestamptz),
(62,1722,'MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','2026-01-27T02:11:09.378Z'::timestamptz),
(63,2696,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-01-27T05:33:41.160Z'::timestamptz),
(64,4101,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-01-28T08:52:24.687Z'::timestamptz),
(65,3388,'NAJJEs4C9QRDffTejzyUC9uRByreeK6x7cvMHWtG3mS3','2026-01-28T23:21:03.301Z'::timestamptz),
(66,865,'MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','2026-01-27T11:09:46.171Z'::timestamptz),
(67,3633,'NAJJEs4C9QRDffTejzyUC9uRByreeK6x7cvMHWtG3mS3','2026-01-31T08:55:15.707Z'::timestamptz),
(68,514,'3cSYcZcYiB8HU7wMVAGRL7StsXt1gXgL3rdV4tsBG1Cd','2026-01-29T21:44:01.521Z'::timestamptz),
(69,2253,'BL8GmhJi6WKFHMa6UcmV6UZAxKdaTNcW9Whu1rtJzYrK','2026-01-29T06:38:11.200Z'::timestamptz),
(70,3770,'5DrvsWxE1YWoAbTDj6ZyHM2ouQqRWeppYb341YZb6Hbn','2026-01-31T03:59:03.763Z'::timestamptz),
(71,2887,'5DrvsWxE1YWoAbTDj6ZyHM2ouQqRWeppYb341YZb6Hbn','2026-02-01T10:45:56.044Z'::timestamptz),
(72,2744,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-01-31T11:15:50.591Z'::timestamptz),
(73,1726,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-01-30T13:04:26.400Z'::timestamptz),
(74,2043,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-01-31T09:19:25.931Z'::timestamptz),
(75,2480,'MQNvSuGofcVPe4hv5TcJHfMTt1qVv2owZ9zBTuf2XBVj','2026-02-01T16:43:52.841Z'::timestamptz),
(76,3872,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-02-02T05:01:06.241Z'::timestamptz),
(77,4479,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-01-31T09:13:18.338Z'::timestamptz),
(78,1487,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-02-03T06:47:23.579Z'::timestamptz),
(79,1920,'RHjPEJYcYyBiG2EnFeXYq7UMqnNXu3HAJhwzbYYmu5Cv','2026-02-03T10:23:36.779Z'::timestamptz),
(80,4179,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-02-01T08:09:21.753Z'::timestamptz),
(81,1463,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-02-04T04:28:09.185Z'::timestamptz),
(82,917,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-02-01T20:06:02.017Z'::timestamptz),
(83,4545,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-02-03T07:01:25.913Z'::timestamptz),
(84,1030,'3ehHTBeunc2tsrUWY9e3RmGiQkpipNKy66c6h9qtTMJ7','2026-02-02T23:34:59.494Z'::timestamptz),
(85,2400,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-02-06T02:53:34.825Z'::timestamptz),
(86,1893,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-02-04T01:55:57.248Z'::timestamptz),
(87,4083,'Ki7sGTgPfaTWWVPhnmSQypacnQqfX36uYk81in7Mmnih','2026-02-05T08:30:53.730Z'::timestamptz),
(88,3865,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-02-06T23:34:56.142Z'::timestamptz),
(89,3736,'9k61cL8f1a8Z1phdMm4B9zGenzkwNouNJLrg8nzgCmTd','2026-02-07T17:57:38.680Z'::timestamptz),
(90,1023,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-02-05T22:21:49.294Z'::timestamptz),
(91,4691,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-02-08T16:08:36.755Z'::timestamptz),
(92,2778,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-02-06T13:53:11.932Z'::timestamptz),
(93,2850,'NYQbWWNBQWTR3T29TrDUaJy7MgjLVweCR6B5ouGVuhdj','2026-02-08T18:42:18.419Z'::timestamptz),
(94,3948,'TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','2026-02-07T11:35:29.798Z'::timestamptz),
(95,3761,'cES5aVzWCozgeT4xPoqg7AsRAcNpsQ459coLeTSkL2L5','2026-02-08T11:14:57.941Z'::timestamptz),
(96,3683,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-02-08T06:54:22.647Z'::timestamptz),
(97,643,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-02-10T05:31:12.467Z'::timestamptz),
(98,2868,'9k61cL8f1a8Z1phdMm4B9zGenzkwNouNJLrg8nzgCmTd','2026-02-08T11:51:32.402Z'::timestamptz),
(99,1140,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-02-08T08:59:40.596Z'::timestamptz),
(100,666,'p4pRUbkKukN2njr47z9XLFbvVDwQco4kPzBsdXXTxPui','2026-02-09T02:13:13.105Z'::timestamptz),
(101,2275,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-02-10T05:30:45.008Z'::timestamptz),
(102,1321,'4BKvPBeTAnjSwpe7dpEXZHHNeNqfm6377x2ojmH2mRFE','2026-02-10T01:16:41.733Z'::timestamptz),
(103,4047,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-02-11T16:30:46.341Z'::timestamptz),
(104,2088,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-02-10T05:33:14.325Z'::timestamptz),
(105,3380,'2UGbkX5c2DmJ7LhDejmmC4z1DnLEn9DFZ2qZeZowPKYT','2026-02-12T21:02:31.003Z'::timestamptz),
(106,368,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-02-13T12:45:01.683Z'::timestamptz),
(107,1743,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-02-13T08:01:17.747Z'::timestamptz),
(108,3757,'MQNvSuGofcVPe4hv5TcJHfMTt1qVv2owZ9zBTuf2XBVj','2026-02-13T18:01:29.739Z'::timestamptz),
(109,3448,'WvKQKspnYcjfqFidTzxsEZsGyGetgyigMg1yJZ7MbDXL','2026-02-14T16:21:06.178Z'::timestamptz),
(110,2106,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-02-12T15:18:28.620Z'::timestamptz),
(111,2456,'h85TESphRgjDpFpfgsqWwpoKhVscDeTQjJUoDRc2gh7X','2026-02-15T10:31:42.722Z'::timestamptz),
(112,2640,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-02-15T20:41:59.550Z'::timestamptz),
(113,653,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-02-16T03:55:47.826Z'::timestamptz),
(114,1007,'QDLySA1CJmfeNEB7Bt2ScLYgfuLDm3jp4wGR16SNYyZX','2026-02-15T03:57:07.434Z'::timestamptz),
(115,4158,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-02-14T22:58:29.761Z'::timestamptz),
(116,2862,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-02-14T08:26:44.506Z'::timestamptz),
(117,4931,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-02-17T10:25:19.505Z'::timestamptz),
(118,3690,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-02-17T17:41:28.708Z'::timestamptz),
(119,4010,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-02-15T13:11:10.174Z'::timestamptz),
(120,3439,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-02-17T00:26:44.926Z'::timestamptz),
(121,3364,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-02-15T16:37:02.162Z'::timestamptz),
(122,858,'au2Q4HtK7mywVq2XK5MUh1rha7EXcQADMkaMBGC7CYmU','2026-02-16T10:47:02.210Z'::timestamptz),
(123,3726,'3ehHTBeunc2tsrUWY9e3RmGiQkpipNKy66c6h9qtTMJ7','2026-02-18T21:50:55.269Z'::timestamptz),
(124,2252,'pwd8Ac7k2hKiMkzBffou3QiSNFMb92kBpq64vFy8jgHo','2026-02-16T17:46:03.752Z'::timestamptz),
(125,94,'3ehHTBeunc2tsrUWY9e3RmGiQkpipNKy66c6h9qtTMJ7','2026-02-19T11:55:57.966Z'::timestamptz),
(126,1239,'qVGw6wKZFSmYwPASTiepmVwK9CebepRPtqf8CjQWqUW5','2026-02-19T07:19:18.891Z'::timestamptz),
(127,4013,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-02-21T11:19:49.422Z'::timestamptz),
(128,3249,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-02-20T17:00:42.390Z'::timestamptz),
(129,2075,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-02-20T19:26:54.648Z'::timestamptz),
(130,2658,'vA9ybRpg5mw1UJoa6jNLtvYHksujBg6zh1FdYjH5beV9','2026-02-22T14:47:57.764Z'::timestamptz),
(131,3397,'UULKeR8k6j1yGZpa6aBYJo9FNQjQ5xFX78xiEn4RHuya','2026-02-20T04:19:50.731Z'::timestamptz),
(132,4763,'nABDma8ZFrqrJwDQsrfc1wqXPd1xVRxvvhC5G5QPRBve','2026-02-22T05:02:36.826Z'::timestamptz),
(133,1152,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-02-22T23:55:59.118Z'::timestamptz),
(134,3654,'baQ45Ka6oLzGKxxgRRdSE2HbUHd9RkjXT4L5p8irmQuy','2026-02-23T04:24:51.713Z'::timestamptz),
(135,1778,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-02-21T03:59:30.843Z'::timestamptz),
(136,3419,'BL8GmhJi6WKFHMa6UcmV6UZAxKdaTNcW9Whu1rtJzYrK','2026-02-21T16:21:38.089Z'::timestamptz),
(137,1527,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-02-25T03:16:55.164Z'::timestamptz),
(138,3076,'UULKeR8k6j1yGZpa6aBYJo9FNQjQ5xFX78xiEn4RHuya','2026-02-25T00:38:40.873Z'::timestamptz),
(139,1897,'JrH65VFWrnmYhyW5ptuiBquyb8RiMqvXuNBe2r3Qo4Bk','2026-02-25T09:02:26.619Z'::timestamptz),
(140,4985,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-02-22T08:57:51.291Z'::timestamptz),
(141,2548,'EUjBYtJvv35BoNFqnZjdteGDEVYHxr7Pr9KfweDJrpjo','2026-02-24T04:06:34.398Z'::timestamptz),
(142,4795,'3ehHTBeunc2tsrUWY9e3RmGiQkpipNKy66c6h9qtTMJ7','2026-02-22T22:19:07.604Z'::timestamptz),
(143,513,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-02-24T20:35:08.365Z'::timestamptz),
(144,1096,'QCRsqhZdAQPaRDXXd9vCTPZm4jBHVJ9opug33K58V9sK','2026-02-26T09:47:09.742Z'::timestamptz),
(145,4710,'KvpN2fpaR9MKxZBeMPNVJ7hecZmPYnkQXEMiS8tGpmNS','2026-02-24T05:46:13.446Z'::timestamptz),
(146,4078,'MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','2026-02-27T14:50:08.595Z'::timestamptz),
(147,3913,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-02-25T03:36:52.649Z'::timestamptz),
(148,3567,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-02-28T17:15:01.133Z'::timestamptz),
(149,2764,'ZL4TWbfCtZUiwEHLH6z1wsFvWAeZ12F9p1FaHeryQYpJ','2026-02-27T16:05:13.363Z'::timestamptz),
(150,1149,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-02-26T20:19:09.265Z'::timestamptz),
(151,891,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-03-01T10:31:15.199Z'::timestamptz),
(152,2157,'HYU5649zRdCYRzh2QC5B9ztiobiwUq3LYyHcWRY4e1Th','2026-03-02T09:12:12.263Z'::timestamptz),
(153,4385,'TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','2026-02-27T19:09:59.775Z'::timestamptz),
(154,3762,'F1CLhnLYRivgPFy4ZGaCKPDoD4MqzLexdJdEGfEv5smE','2026-03-01T13:38:34.604Z'::timestamptz),
(155,4828,'3cSYcZcYiB8HU7wMVAGRL7StsXt1gXgL3rdV4tsBG1Cd','2026-02-28T12:35:11.082Z'::timestamptz),
(156,3064,'5DrvsWxE1YWoAbTDj6ZyHM2ouQqRWeppYb341YZb6Hbn','2026-03-03T08:19:46.939Z'::timestamptz),
(157,3389,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-02-28T21:58:12.078Z'::timestamptz),
(158,2962,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-02-28T20:28:38.911Z'::timestamptz),
(159,4919,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-03-01T23:06:20.291Z'::timestamptz),
(160,773,'nmoFDY4jxwWi7N5e4zcsTagSjnXQDkevRjMdw65asc1S','2026-03-02T23:27:58.996Z'::timestamptz),
(161,3970,'BL8GmhJi6WKFHMa6UcmV6UZAxKdaTNcW9Whu1rtJzYrK','2026-03-04T02:01:15.115Z'::timestamptz),
(162,1390,'h85TESphRgjDpFpfgsqWwpoKhVscDeTQjJUoDRc2gh7X','2026-03-02T06:37:33.352Z'::timestamptz),
(163,136,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-03-03T02:17:00.541Z'::timestamptz),
(164,2146,'2UGbkX5c2DmJ7LhDejmmC4z1DnLEn9DFZ2qZeZowPKYT','2026-03-04T22:06:25.346Z'::timestamptz),
(165,589,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-03-06T02:33:07.619Z'::timestamptz),
(166,20,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-03-04T17:39:49.668Z'::timestamptz),
(167,1366,'Q19hwFNs8PvmjCCdR2fMNjTNTAS5Ckno2xybmn2AQYjm','2026-03-05T07:23:45.953Z'::timestamptz),
(168,1456,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-03-06T20:39:24.885Z'::timestamptz),
(169,4935,'g66VHjXcbpF7wAwkuMKcRSBWDgpzVW5x5KpXsAMP1dsr','2026-03-05T04:50:32.523Z'::timestamptz),
(170,1924,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-03-08T12:44:42.669Z'::timestamptz),
(171,977,'8qpBGG6atMZdNqgPNsKrUsydYM7nXqqoVSTdr6j3wy9n','2026-03-06T12:02:35.370Z'::timestamptz),
(172,2829,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-03-06T07:25:47.711Z'::timestamptz),
(173,3992,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-03-09T19:00:54.872Z'::timestamptz),
(174,4304,'baQ45Ka6oLzGKxxgRRdSE2HbUHd9RkjXT4L5p8irmQuy','2026-03-08T12:20:43.061Z'::timestamptz),
(175,4585,'RVDVQaj22zGAGpAEyJRrkkiMsd2WymJjDFdG1SCBbJ8q','2026-03-08T21:46:41.684Z'::timestamptz),
(176,2237,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-03-09T08:02:39.497Z'::timestamptz),
(177,3109,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-03-09T17:32:59.767Z'::timestamptz),
(178,2149,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-03-11T00:14:59.746Z'::timestamptz),
(179,4265,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-03-11T17:26:44.182Z'::timestamptz),
(180,404,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-03-12T00:56:16.920Z'::timestamptz),
(181,370,'p4pRUbkKukN2njr47z9XLFbvVDwQco4kPzBsdXXTxPui','2026-03-12T09:25:42.458Z'::timestamptz),
(182,3184,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-03-11T07:26:26.761Z'::timestamptz),
(183,353,'vA9ybRpg5mw1UJoa6jNLtvYHksujBg6zh1FdYjH5beV9','2026-03-09T08:10:57.456Z'::timestamptz),
(184,1740,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-03-09T19:32:32.958Z'::timestamptz),
(185,4281,'TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','2026-03-12T19:10:41.988Z'::timestamptz),
(186,866,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-03-10T21:53:42.765Z'::timestamptz),
(187,1601,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-03-11T15:52:26.470Z'::timestamptz),
(188,2131,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-03-13T17:16:05.459Z'::timestamptz),
(189,610,'RmDc8rH9mQkUeS4QXpHFR5Z5Sj5aYcPxwDS6uRCtPjk3','2026-03-11T13:40:17.796Z'::timestamptz),
(190,2942,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-03-15T02:06:06.242Z'::timestamptz),
(191,3695,'8qpBGG6atMZdNqgPNsKrUsydYM7nXqqoVSTdr6j3wy9n','2026-03-13T22:23:00.745Z'::timestamptz),
(192,4088,'EcUf8HcSwQwEYYzYNmJjRFXKw1d1nZFkWKRbviHASHkB','2026-03-15T12:35:54.149Z'::timestamptz),
(193,4218,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-03-15T18:22:00.200Z'::timestamptz),
(194,2241,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-03-17T01:09:05.233Z'::timestamptz),
(195,1960,'UA7w1dZaSabvZrZmbx4k6zm2BuLow9N2cDuvvTP2YpzV','2026-03-14T01:14:08.507Z'::timestamptz),
(196,854,'baQ45Ka6oLzGKxxgRRdSE2HbUHd9RkjXT4L5p8irmQuy','2026-03-17T20:18:28.738Z'::timestamptz),
(197,2595,'uQCXFLBWwqMtNjihMyz3pKhjX8Cyk6j1RTkPA5qr4mS4','2026-03-16T06:31:26.433Z'::timestamptz),
(198,2291,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-03-15T16:15:37.280Z'::timestamptz),
(199,4641,'cZFSA3twdYjiSYd2WAY82cHv4WG4br4G92AUu5MwzqyS','2026-03-15T01:51:45.156Z'::timestamptz),
(200,4380,'XkBCbBs1LTy16L27qxPH2DAGjjNZnYBTZCdGnU2WhKMa','2026-03-18T14:31:28.616Z'::timestamptz),
(201,4653,'siFmeoSaRs6MhKCXK56ScZSzLtpT3qXeWweQkYF8dA3c','2026-03-16T22:33:04.443Z'::timestamptz),
(202,3142,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-03-19T09:02:57.712Z'::timestamptz),
(203,3116,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-03-17T18:11:48.787Z'::timestamptz),
(204,3233,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-03-19T13:55:40.922Z'::timestamptz),
(205,3904,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-03-18T12:15:38.870Z'::timestamptz),
(206,4517,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-03-17T14:19:34.335Z'::timestamptz),
(207,1912,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-03-17T23:41:47.770Z'::timestamptz),
(208,3847,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-03-21T11:20:07.991Z'::timestamptz),
(209,4126,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-03-18T15:18:33.756Z'::timestamptz),
(210,4328,'Ki7sGTgPfaTWWVPhnmSQypacnQqfX36uYk81in7Mmnih','2026-03-21T15:58:30.713Z'::timestamptz),
(211,881,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-03-23T00:43:54.511Z'::timestamptz),
(212,595,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-03-21T02:29:46.608Z'::timestamptz),
(213,1571,'EcUf8HcSwQwEYYzYNmJjRFXKw1d1nZFkWKRbviHASHkB','2026-03-21T14:52:22.327Z'::timestamptz),
(214,143,'QCRsqhZdAQPaRDXXd9vCTPZm4jBHVJ9opug33K58V9sK','2026-03-21T08:05:43.736Z'::timestamptz),
(215,3332,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-03-23T12:00:08.488Z'::timestamptz),
(216,497,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-03-22T17:09:25.150Z'::timestamptz),
(217,799,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-03-23T03:59:35.047Z'::timestamptz),
(218,1936,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-03-22T09:51:23.290Z'::timestamptz),
(219,3339,'t4Zx18iZgPCKdSNDVEvrzEiytcxSrSyqGkAusFYyVAeT','2026-03-22T01:12:44.906Z'::timestamptz),
(220,1725,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-03-25T13:53:35.554Z'::timestamptz),
(221,285,'ZL4TWbfCtZUiwEHLH6z1wsFvWAeZ12F9p1FaHeryQYpJ','2026-03-23T04:55:19.649Z'::timestamptz),
(222,2542,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-03-24T01:42:09.764Z'::timestamptz),
(223,2240,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-03-24T09:18:10.941Z'::timestamptz),
(224,974,'EJP8o6tCeeLQmLzfJWur2MspXnm1X5PnsiakkNsnci1S','2026-03-25T07:03:41.394Z'::timestamptz),
(225,3278,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-03-25T22:44:50.977Z'::timestamptz),
(226,2360,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-03-27T04:46:48.970Z'::timestamptz),
(227,217,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-03-26T01:26:04.408Z'::timestamptz),
(228,679,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-03-26T05:54:31.845Z'::timestamptz),
(229,611,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-03-28T15:34:40.879Z'::timestamptz),
(230,2614,'EUjBYtJvv35BoNFqnZjdteGDEVYHxr7Pr9KfweDJrpjo','2026-03-27T14:49:26.474Z'::timestamptz),
(231,1394,'BL8GmhJi6WKFHMa6UcmV6UZAxKdaTNcW9Whu1rtJzYrK','2026-03-27T22:13:31.800Z'::timestamptz),
(232,4760,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-03-27T06:43:19.244Z'::timestamptz),
(233,1184,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-03-29T03:14:08.520Z'::timestamptz),
(234,524,'NAJJEs4C9QRDffTejzyUC9uRByreeK6x7cvMHWtG3mS3','2026-03-30T22:20:25.349Z'::timestamptz),
(235,939,'ZbNYx3vx4WSXdSCXao7FgSPiETd3b62YFmv3msR3HisA','2026-03-27T16:55:02.344Z'::timestamptz),
(236,713,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-03-30T23:05:42.279Z'::timestamptz),
(237,3175,'Q19hwFNs8PvmjCCdR2fMNjTNTAS5Ckno2xybmn2AQYjm','2026-03-30T17:51:35.461Z'::timestamptz),
(238,1718,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-03-30T11:34:44.135Z'::timestamptz),
(239,904,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-03-30T18:39:40.693Z'::timestamptz),
(240,2656,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-03-31T03:04:59.180Z'::timestamptz),
(241,636,'Q19hwFNs8PvmjCCdR2fMNjTNTAS5Ckno2xybmn2AQYjm','2026-03-31T03:11:12.932Z'::timestamptz),
(242,1761,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-03-31T08:11:03.423Z'::timestamptz),
(243,3818,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-04-02T14:07:04.670Z'::timestamptz),
(244,1577,'F1CLhnLYRivgPFy4ZGaCKPDoD4MqzLexdJdEGfEv5smE','2026-04-02T03:39:16.803Z'::timestamptz),
(245,1959,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-04-01T07:58:17.956Z'::timestamptz),
(246,632,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-04-03T20:35:00.035Z'::timestamptz),
(247,628,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-04-03T20:16:20.253Z'::timestamptz),
(248,3261,'5mEW6FSZbfg9rV2j6Rgjo3Zr96nh1yzTKetyJBAJTWqR','2026-04-03T17:26:46.186Z'::timestamptz),
(249,4372,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-04-02T04:49:36.995Z'::timestamptz),
(250,2793,'9SnXcRSFTELMTvtkBU9boqD5ogpspVRkTF3ziGJQoGiM','2026-04-02T01:32:07.745Z'::timestamptz),
(251,2878,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-04-06T03:49:11.849Z'::timestamptz),
(252,1519,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-04-05T10:41:54.891Z'::timestamptz),
(253,3572,'Ki7sGTgPfaTWWVPhnmSQypacnQqfX36uYk81in7Mmnih','2026-04-03T04:24:53.831Z'::timestamptz),
(254,1579,'t4Zx18iZgPCKdSNDVEvrzEiytcxSrSyqGkAusFYyVAeT','2026-04-03T16:09:20.040Z'::timestamptz),
(255,4554,'NAJJEs4C9QRDffTejzyUC9uRByreeK6x7cvMHWtG3mS3','2026-04-03T22:54:21.566Z'::timestamptz),
(256,3275,'ToDTZXWy58HxqPSH64JnR7Buxv9HTQ8V8FdsyrahZSfz','2026-04-04T17:53:28.451Z'::timestamptz),
(257,2532,'TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','2026-04-04T22:29:45.308Z'::timestamptz),
(258,1408,'ToDTZXWy58HxqPSH64JnR7Buxv9HTQ8V8FdsyrahZSfz','2026-04-07T20:45:42.778Z'::timestamptz),
(259,1106,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-04-07T21:47:19.049Z'::timestamptz),
(260,744,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-04-06T06:13:31.154Z'::timestamptz),
(261,4184,'5DrvsWxE1YWoAbTDj6ZyHM2ouQqRWeppYb341YZb6Hbn','2026-04-06T08:32:38.868Z'::timestamptz),
(262,549,'nABDma8ZFrqrJwDQsrfc1wqXPd1xVRxvvhC5G5QPRBve','2026-04-08T15:35:51.128Z'::timestamptz),
(263,2960,'3ehHTBeunc2tsrUWY9e3RmGiQkpipNKy66c6h9qtTMJ7','2026-04-07T14:22:03.082Z'::timestamptz),
(264,1338,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-04-09T08:43:12.323Z'::timestamptz),
(265,4754,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-04-08T11:07:15.250Z'::timestamptz),
(266,212,'nVdrPN1x9sJDws1UwwHXSmSxDen32CfnYpr1svigsQHL','2026-04-08T20:02:52.162Z'::timestamptz),
(267,1207,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-04-09T23:46:24.811Z'::timestamptz),
(268,2079,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-04-08T11:47:55.875Z'::timestamptz),
(269,765,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-04-10T05:33:12.313Z'::timestamptz),
(270,4778,'MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','2026-04-11T05:40:56.374Z'::timestamptz),
(271,4468,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-04-13T02:51:56.794Z'::timestamptz),
(272,892,'RHjPEJYcYyBiG2EnFeXYq7UMqnNXu3HAJhwzbYYmu5Cv','2026-04-13T13:21:17.163Z'::timestamptz),
(273,3830,'QCRsqhZdAQPaRDXXd9vCTPZm4jBHVJ9opug33K58V9sK','2026-04-10T19:48:16.124Z'::timestamptz),
(274,1449,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-04-12T16:30:00.190Z'::timestamptz),
(275,2853,'baQ45Ka6oLzGKxxgRRdSE2HbUHd9RkjXT4L5p8irmQuy','2026-04-13T07:31:18.317Z'::timestamptz),
(276,3924,'hFpiyPm8UKg5hBdTzXLm94H1QEiZHNNL8nKysw6kPrTN','2026-04-13T18:07:31.355Z'::timestamptz),
(277,3445,'QDLySA1CJmfeNEB7Bt2ScLYgfuLDm3jp4wGR16SNYyZX','2026-04-12T13:21:38.345Z'::timestamptz),
(278,204,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-04-15T14:35:16.164Z'::timestamptz),
(279,2639,'F1CLhnLYRivgPFy4ZGaCKPDoD4MqzLexdJdEGfEv5smE','2026-04-13T14:34:30.539Z'::timestamptz),
(280,565,'9SnXcRSFTELMTvtkBU9boqD5ogpspVRkTF3ziGJQoGiM','2026-04-15T21:52:55.218Z'::timestamptz),
(281,3075,'TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','2026-04-13T19:43:54.658Z'::timestamptz),
(282,385,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-04-15T04:01:53.857Z'::timestamptz),
(283,1820,'uQCXFLBWwqMtNjihMyz3pKhjX8Cyk6j1RTkPA5qr4mS4','2026-04-16T07:07:50.728Z'::timestamptz),
(284,1921,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-04-14T12:29:32.248Z'::timestamptz),
(285,2821,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-04-16T12:38:14.746Z'::timestamptz),
(286,823,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-04-16T05:25:18.196Z'::timestamptz),
(287,2645,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-04-16T12:51:57.632Z'::timestamptz),
(288,4247,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-04-15T22:06:38.413Z'::timestamptz),
(289,165,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-04-19T04:59:41.989Z'::timestamptz),
(290,3921,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-04-17T12:49:40.946Z'::timestamptz),
(291,4879,'T5bFnyVxgiYPbtZXDUhERGnMBmaX3k5nUXWNJrZj4w2j','2026-04-17T18:11:41.744Z'::timestamptz),
(292,2129,'RUz37ya9EMZTCDjoVw4YbZpjb8q6YN7HiVrybpX3dzic','2026-04-17T10:22:04.704Z'::timestamptz),
(293,4866,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-04-17T18:37:05.310Z'::timestamptz),
(294,775,'97C6BD8uKT5UecxptgoWex9TwhPng2BpXgyEbE5mDNFy','2026-04-18T22:24:49.704Z'::timestamptz),
(295,4835,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-04-20T17:08:22.153Z'::timestamptz),
(296,3553,'MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','2026-04-20T10:13:39.191Z'::timestamptz),
(297,33,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-04-19T10:29:52.725Z'::timestamptz),
(298,2794,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-04-21T18:50:46.151Z'::timestamptz),
(299,139,'NAJJEs4C9QRDffTejzyUC9uRByreeK6x7cvMHWtG3mS3','2026-04-22T12:48:49.423Z'::timestamptz),
(300,2197,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-04-20T05:15:54.252Z'::timestamptz),
(301,1557,'SjFc5xCjunC2GAEsZ7CNhDiAARXBGnTLJghr1W16u6f2','2026-04-23T07:30:11.928Z'::timestamptz),
(302,333,'HYU5649zRdCYRzh2QC5B9ztiobiwUq3LYyHcWRY4e1Th','2026-04-20T15:09:23.076Z'::timestamptz),
(303,2104,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-04-21T08:49:50.208Z'::timestamptz),
(304,4986,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-04-24T19:51:46.212Z'::timestamptz),
(305,4934,'jjaN7AxhZAXmrvAjrjWQcXinvqtJvVDMFBTAvQSMvEKB','2026-04-22T16:55:27.711Z'::timestamptz),
(306,1342,'jfNeBRxdDEEPN6vf6nDHytr88LcrkqFV3BCwJuAFi9jM','2026-04-21T16:16:05.218Z'::timestamptz),
(307,391,'BL8GmhJi6WKFHMa6UcmV6UZAxKdaTNcW9Whu1rtJzYrK','2026-04-22T21:16:37.322Z'::timestamptz),
(308,1201,'nVdrPN1x9sJDws1UwwHXSmSxDen32CfnYpr1svigsQHL','2026-04-24T02:12:33.215Z'::timestamptz),
(309,4961,'cZFSA3twdYjiSYd2WAY82cHv4WG4br4G92AUu5MwzqyS','2026-04-25T01:45:08.664Z'::timestamptz),
(310,2842,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-04-26T23:36:44.938Z'::timestamptz),
(311,1308,'F1CLhnLYRivgPFy4ZGaCKPDoD4MqzLexdJdEGfEv5smE','2026-04-23T20:02:09.792Z'::timestamptz),
(312,2403,'WvKQKspnYcjfqFidTzxsEZsGyGetgyigMg1yJZ7MbDXL','2026-04-24T02:53:01.265Z'::timestamptz),
(313,2098,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-04-25T13:54:03.857Z'::timestamptz),
(314,4945,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-04-24T15:46:19.063Z'::timestamptz),
(315,3519,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-04-28T00:08:59.245Z'::timestamptz),
(316,3433,'wbuGdkNuQkj7mWiY7h83UNiAZdwpgJn4MhiDG1i2b1iU','2026-04-26T10:17:33.059Z'::timestamptz),
(317,303,'RHjPEJYcYyBiG2EnFeXYq7UMqnNXu3HAJhwzbYYmu5Cv','2026-04-28T19:22:10.534Z'::timestamptz),
(318,686,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-04-26T07:09:08.472Z'::timestamptz),
(319,2906,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-04-26T15:47:14.296Z'::timestamptz),
(320,4837,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-04-30T04:52:30.023Z'::timestamptz),
(321,1737,'h85TESphRgjDpFpfgsqWwpoKhVscDeTQjJUoDRc2gh7X','2026-04-30T12:44:01.372Z'::timestamptz),
(322,2647,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-04-29T19:06:24.911Z'::timestamptz),
(323,4053,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-05-01T05:31:37.859Z'::timestamptz),
(324,847,'BL8GmhJi6WKFHMa6UcmV6UZAxKdaTNcW9Whu1rtJzYrK','2026-04-29T19:33:53.318Z'::timestamptz),
(325,444,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-04-29T19:03:57.821Z'::timestamptz),
(326,4399,'cES5aVzWCozgeT4xPoqg7AsRAcNpsQ459coLeTSkL2L5','2026-04-30T12:01:42.497Z'::timestamptz),
(327,339,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-04-29T21:40:53.238Z'::timestamptz),
(328,2303,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-05-02T12:35:02.780Z'::timestamptz),
(329,1894,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-04-30T09:19:15.617Z'::timestamptz),
(330,4300,'siFmeoSaRs6MhKCXK56ScZSzLtpT3qXeWweQkYF8dA3c','2026-05-02T12:28:36.211Z'::timestamptz),
(331,2500,'ZL4TWbfCtZUiwEHLH6z1wsFvWAeZ12F9p1FaHeryQYpJ','2026-05-01T20:09:54.760Z'::timestamptz),
(332,2807,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-05-03T21:15:57.392Z'::timestamptz),
(333,3151,'MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','2026-05-01T14:59:01.719Z'::timestamptz),
(334,3748,'gUUohZVWwH6GEy8Zr4JV7Y79uPSxmeRt4LzrLZujCsjg','2026-05-05T01:34:02.795Z'::timestamptz),
(335,3973,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-05-03T14:39:32.951Z'::timestamptz),
(336,4721,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-05-03T04:04:13.064Z'::timestamptz),
(337,13,'wJTFjs2Wm4R2sejeRCRoYkpPxiEcELeUu9jQhNedevQR','2026-05-04T18:26:14.222Z'::timestamptz),
(338,1790,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-05-04T18:59:25.385Z'::timestamptz),
(339,2523,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-05-05T09:03:33.100Z'::timestamptz),
(340,696,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-05-07T03:17:03.702Z'::timestamptz),
(341,4455,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-05-07T04:48:17.727Z'::timestamptz),
(342,2766,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-05-06T06:04:41.847Z'::timestamptz),
(343,2564,'YZCjY84F4q1kZ7HNpMoso9mA4sweHmSF2HKeHMs8UBqo','2026-05-07T01:09:07.870Z'::timestamptz),
(344,409,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-05-06T17:49:18.722Z'::timestamptz),
(345,3963,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-05-06T17:13:57.346Z'::timestamptz),
(346,4325,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-05-07T18:24:11.532Z'::timestamptz),
(347,1334,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-05-08T01:17:43.991Z'::timestamptz),
(348,3800,'9Bh3WaVoXyWK9sm3fq97JEXrSEQkkF9Xc4WCpM7hQ2Rr','2026-05-06T19:06:36.230Z'::timestamptz),
(349,3930,'RmDc8rH9mQkUeS4QXpHFR5Z5Sj5aYcPxwDS6uRCtPjk3','2026-05-09T21:05:55.728Z'::timestamptz),
(350,4312,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-05-07T01:16:35.396Z'::timestamptz),
(351,2699,'5mEW6FSZbfg9rV2j6Rgjo3Zr96nh1yzTKetyJBAJTWqR','2026-05-09T07:56:53.447Z'::timestamptz),
(352,1087,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-05-08T18:12:41.677Z'::timestamptz),
(353,2140,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-05-08T20:38:14.550Z'::timestamptz),
(354,98,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-05-11T19:44:59.963Z'::timestamptz),
(355,2433,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-05-11T13:05:53.445Z'::timestamptz),
(356,1551,'TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','2026-05-12T17:30:41.646Z'::timestamptz),
(357,2785,'F1CLhnLYRivgPFy4ZGaCKPDoD4MqzLexdJdEGfEv5smE','2026-05-12T09:37:00.338Z'::timestamptz),
(358,2674,'NAJJEs4C9QRDffTejzyUC9uRByreeK6x7cvMHWtG3mS3','2026-05-10T22:56:50.686Z'::timestamptz),
(359,2167,'ToDTZXWy58HxqPSH64JnR7Buxv9HTQ8V8FdsyrahZSfz','2026-05-13T15:06:10.970Z'::timestamptz),
(360,929,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-05-12T19:29:49.461Z'::timestamptz),
(361,1935,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-05-12T18:50:28.296Z'::timestamptz),
(362,1169,'NAJJEs4C9QRDffTejzyUC9uRByreeK6x7cvMHWtG3mS3','2026-05-12T09:19:18.053Z'::timestamptz),
(363,3585,'g66VHjXcbpF7wAwkuMKcRSBWDgpzVW5x5KpXsAMP1dsr','2026-05-15T14:31:38.844Z'::timestamptz),
(364,484,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-05-13T09:51:38.092Z'::timestamptz),
(365,4811,'SjFc5xCjunC2GAEsZ7CNhDiAARXBGnTLJghr1W16u6f2','2026-05-12T13:24:50.916Z'::timestamptz),
(366,3009,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-05-12T22:11:28.801Z'::timestamptz),
(367,1374,'Ki7sGTgPfaTWWVPhnmSQypacnQqfX36uYk81in7Mmnih','2026-05-14T11:36:27.022Z'::timestamptz),
(368,242,'F1CLhnLYRivgPFy4ZGaCKPDoD4MqzLexdJdEGfEv5smE','2026-05-16T04:23:42.443Z'::timestamptz),
(369,2196,'osfPt3SoPb3s7PJwR5KvXZ8pTbVtfQXX6Up5bHu2dsL3','2026-05-13T21:30:19.859Z'::timestamptz),
(370,3958,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-05-15T07:02:25.437Z'::timestamptz),
(371,3208,'JrH65VFWrnmYhyW5ptuiBquyb8RiMqvXuNBe2r3Qo4Bk','2026-05-16T08:17:18.723Z'::timestamptz),
(372,1682,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-05-16T01:39:34.237Z'::timestamptz),
(373,591,'2UGbkX5c2DmJ7LhDejmmC4z1DnLEn9DFZ2qZeZowPKYT','2026-05-16T21:08:13.386Z'::timestamptz),
(374,616,'3WrSVq3wACYa3jkbJssjbTqR4C5Emz5JCXABYbJoqGLR','2026-05-17T15:59:32.191Z'::timestamptz),
(375,1968,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-05-18T01:14:21.277Z'::timestamptz),
(376,4301,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-05-19T03:20:09.840Z'::timestamptz),
(377,4995,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-05-18T08:26:51.427Z'::timestamptz),
(378,2034,'MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','2026-05-19T23:00:57.326Z'::timestamptz),
(379,1301,'uisJorf8tmKduAtLkUHcneBfFd28DafQTkf9L2bXU1EV','2026-05-19T03:40:34.708Z'::timestamptz),
(380,11,'WqaAdsEhLfUqEB7JfLi9hmGzJga66TjAwehkutCVugF2','2026-05-21T13:20:33.017Z'::timestamptz),
(381,2179,'2eaZ7LmLeeCYC7KD4BLBaDoM5gLFavZB9tBeP5H64Qse','2026-05-18T04:47:25.480Z'::timestamptz),
(382,3923,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-05-20T10:38:38.384Z'::timestamptz),
(383,4686,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-05-22T08:39:22.912Z'::timestamptz),
(384,3927,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-05-22T22:25:16.014Z'::timestamptz),
(385,3399,'uQCXFLBWwqMtNjihMyz3pKhjX8Cyk6j1RTkPA5qr4mS4','2026-05-22T11:51:42.786Z'::timestamptz),
(386,3590,'RmDc8rH9mQkUeS4QXpHFR5Z5Sj5aYcPxwDS6uRCtPjk3','2026-05-22T21:15:54.007Z'::timestamptz),
(387,3335,'BL8GmhJi6WKFHMa6UcmV6UZAxKdaTNcW9Whu1rtJzYrK','2026-05-20T10:42:21.435Z'::timestamptz),
(388,1204,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-05-24T02:21:15.534Z'::timestamptz),
(389,758,'baQ45Ka6oLzGKxxgRRdSE2HbUHd9RkjXT4L5p8irmQuy','2026-05-24T08:30:10.039Z'::timestamptz),
(390,4408,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-05-24T03:51:52.692Z'::timestamptz),
(391,3616,'UA7w1dZaSabvZrZmbx4k6zm2BuLow9N2cDuvvTP2YpzV','2026-05-23T06:57:28.332Z'::timestamptz),
(392,2298,'EUjBYtJvv35BoNFqnZjdteGDEVYHxr7Pr9KfweDJrpjo','2026-05-24T23:34:49.312Z'::timestamptz),
(393,3583,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-05-22T06:47:49.694Z'::timestamptz),
(394,3326,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-05-26T08:54:27.505Z'::timestamptz),
(395,4887,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-05-25T16:52:37.583Z'::timestamptz),
(396,3979,'5DrvsWxE1YWoAbTDj6ZyHM2ouQqRWeppYb341YZb6Hbn','2026-05-26T09:19:15.443Z'::timestamptz),
(397,2551,'SjFc5xCjunC2GAEsZ7CNhDiAARXBGnTLJghr1W16u6f2','2026-05-27T09:25:21.106Z'::timestamptz),
(398,2831,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-05-26T02:25:03.571Z'::timestamptz),
(399,2282,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-05-24T14:06:28.677Z'::timestamptz),
(400,4522,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-05-28T08:48:48.951Z'::timestamptz),
(401,4694,'cES5aVzWCozgeT4xPoqg7AsRAcNpsQ459coLeTSkL2L5','2026-05-25T14:42:59.427Z'::timestamptz),
(402,2671,'TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','2026-05-25T21:59:16.987Z'::timestamptz),
(403,4582,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-05-27T05:55:32.958Z'::timestamptz),
(404,2943,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-05-27T21:51:04.519Z'::timestamptz),
(405,2951,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-05-26T13:17:56.181Z'::timestamptz),
(406,2774,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-05-29T01:59:43.747Z'::timestamptz),
(407,4669,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-05-28T11:02:31.491Z'::timestamptz),
(408,3295,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-05-30T17:28:03.979Z'::timestamptz),
(409,308,'t4Zx18iZgPCKdSNDVEvrzEiytcxSrSyqGkAusFYyVAeT','2026-05-28T18:33:14.725Z'::timestamptz),
(410,2335,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-05-31T21:34:02.837Z'::timestamptz),
(411,2980,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-05-31T10:20:44.275Z'::timestamptz),
(412,2284,'MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','2026-05-30T19:41:18.845Z'::timestamptz),
(413,1578,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-05-31T23:46:23.908Z'::timestamptz),
(414,958,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-05-31T12:47:58.629Z'::timestamptz),
(415,356,'WvKQKspnYcjfqFidTzxsEZsGyGetgyigMg1yJZ7MbDXL','2026-05-31T09:30:43.795Z'::timestamptz),
(416,2812,'BL8GmhJi6WKFHMa6UcmV6UZAxKdaTNcW9Whu1rtJzYrK','2026-06-03T03:16:41.272Z'::timestamptz),
(417,4191,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-05-30T14:51:26.563Z'::timestamptz),
(418,171,'aj5JfbLsdJWwre7RcmNHisAPkvgou9Tu3KPL5F5gRAoN','2026-06-01T12:06:17.889Z'::timestamptz),
(419,327,'RmDc8rH9mQkUeS4QXpHFR5Z5Sj5aYcPxwDS6uRCtPjk3','2026-05-31T23:19:40.906Z'::timestamptz),
(420,2933,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-06-01T17:46:59.187Z'::timestamptz),
(421,2835,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-06-01T19:21:33.744Z'::timestamptz),
(422,721,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-06-03T08:54:53.511Z'::timestamptz),
(423,4249,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-06-03T08:05:22.241Z'::timestamptz),
(424,4241,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-06-04T14:24:34.510Z'::timestamptz),
(425,1979,'nABDma8ZFrqrJwDQsrfc1wqXPd1xVRxvvhC5G5QPRBve','2026-06-04T08:51:27.458Z'::timestamptz),
(426,1073,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-06-04T19:59:35.927Z'::timestamptz),
(427,138,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-06-04T05:38:24.357Z'::timestamptz),
(428,4025,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-06-06T12:58:26.545Z'::timestamptz),
(429,4255,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-06-06T09:55:12.228Z'::timestamptz),
(430,3526,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-06-07T08:06:08.185Z'::timestamptz),
(431,2382,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-06-06T21:22:57.484Z'::timestamptz),
(432,3925,'NTP9d93FTGRFYKgxnYNiZyxN9xM8REjUVKh9kA15GVRz','2026-06-05T01:48:41.647Z'::timestamptz),
(433,3435,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-06-07T17:07:36.369Z'::timestamptz),
(434,4982,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-06-05T14:14:30.184Z'::timestamptz),
(435,355,'baQ45Ka6oLzGKxxgRRdSE2HbUHd9RkjXT4L5p8irmQuy','2026-06-07T23:57:05.079Z'::timestamptz),
(436,2032,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-06-10T03:14:38.753Z'::timestamptz),
(437,3856,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-06-07T20:40:47.031Z'::timestamptz),
(438,244,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-06-07T03:25:25.264Z'::timestamptz),
(439,1359,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-06-09T15:08:43.150Z'::timestamptz),
(440,2802,'RmDc8rH9mQkUeS4QXpHFR5Z5Sj5aYcPxwDS6uRCtPjk3','2026-06-11T11:11:33.848Z'::timestamptz),
(441,3946,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-06-09T10:05:00.816Z'::timestamptz),
(442,4908,'k9NHpDyWT7aki8UgXLKkMzSqrEzjXeVJHPdfGyH5a4mV','2026-06-10T11:36:38.461Z'::timestamptz),
(443,987,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-06-10T00:17:23.069Z'::timestamptz),
(444,4192,'TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','2026-06-10T22:42:45.996Z'::timestamptz),
(445,4483,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-06-10T03:53:14.522Z'::timestamptz),
(446,2827,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-06-12T03:16:05.951Z'::timestamptz),
(447,687,'F1CLhnLYRivgPFy4ZGaCKPDoD4MqzLexdJdEGfEv5smE','2026-06-12T11:01:53.181Z'::timestamptz),
(448,1069,'BQwq8HZwkV8eHADWZRdURvrWuk3aVXR1y2pEPQ1JXVAW','2026-06-12T00:54:09.765Z'::timestamptz),
(449,4212,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-06-11T08:41:25.029Z'::timestamptz),
(450,625,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-06-12T00:08:03.827Z'::timestamptz),
(451,4673,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-06-14T05:15:48.294Z'::timestamptz),
(452,2863,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-06-15T19:12:07.370Z'::timestamptz),
(453,4968,'97C6BD8uKT5UecxptgoWex9TwhPng2BpXgyEbE5mDNFy','2026-06-12T16:03:54.380Z'::timestamptz),
(454,1536,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-06-16T10:31:18.398Z'::timestamptz),
(455,1947,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-06-16T14:42:52.495Z'::timestamptz),
(456,4524,'MNPMAorTBhd3wyfWSG2BLdCAymzETEnMP5Kgw1ZJNGwh','2026-06-14T07:02:04.553Z'::timestamptz),
(457,155,'sRMVnGH4joMw6SCMfEwDhEzSQn3F3DkaCwVmTbe8CQEh','2026-06-14T19:57:35.263Z'::timestamptz),
(458,1696,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-06-14T13:32:26.074Z'::timestamptz),
(459,4165,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-06-16T04:34:19.686Z'::timestamptz),
(460,3057,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-06-17T10:28:45.646Z'::timestamptz),
(461,3005,'ZbNYx3vx4WSXdSCXao7FgSPiETd3b62YFmv3msR3HisA','2026-06-16T12:04:48.153Z'::timestamptz),
(462,2662,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-06-15T16:38:41.581Z'::timestamptz),
(463,3827,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-06-19T14:02:25.657Z'::timestamptz),
(464,1206,'TUMhHAbQBgWHAdMnZs6irf7WJdC3pSHTTV8stEyRjkCn','2026-06-17T07:01:19.789Z'::timestamptz),
(465,2578,'jjaN7AxhZAXmrvAjrjWQcXinvqtJvVDMFBTAvQSMvEKB','2026-06-18T18:33:30.604Z'::timestamptz),
(466,3318,'TVFsuG35TCjWF3q6QkwYqZi1VUW7aLFZcvxERH6GbNPi','2026-06-20T06:00:13.413Z'::timestamptz),
(467,4575,'uisJorf8tmKduAtLkUHcneBfFd28DafQTkf9L2bXU1EV','2026-06-19T20:08:36.380Z'::timestamptz),
(468,4645,'baQ45Ka6oLzGKxxgRRdSE2HbUHd9RkjXT4L5p8irmQuy','2026-06-19T03:13:50.549Z'::timestamptz),
(469,1782,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-06-19T22:51:00.582Z'::timestamptz),
(470,3943,'jjaN7AxhZAXmrvAjrjWQcXinvqtJvVDMFBTAvQSMvEKB','2026-06-20T01:21:19.950Z'::timestamptz),
(471,2627,'7jZ8V9chpen3p5waHRAFz8wBEAe5enjqaPHSNmD8bNka','2026-06-20T11:26:47.647Z'::timestamptz),
(472,4261,'usQL7mW9e8ca88NrLajnhTSgyDLpbKkMnbniwkXyTqva','2026-06-22T12:09:14.639Z'::timestamptz),
(473,4821,'UA7w1dZaSabvZrZmbx4k6zm2BuLow9N2cDuvvTP2YpzV','2026-06-20T23:39:46.884Z'::timestamptz),
(474,3779,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-06-21T15:16:01.679Z'::timestamptz),
(475,3371,'PMmrmgErmF2FWcnK2yn1hWYoboACuz3DSdsVF4BhD5mt','2026-06-20T22:29:13.848Z'::timestamptz),
(476,14,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-06-22T13:43:50.873Z'::timestamptz),
(477,3365,'ZbNYx3vx4WSXdSCXao7FgSPiETd3b62YFmv3msR3HisA','2026-06-22T01:14:26.092Z'::timestamptz),
(478,274,'SHk27Huu1LjtLaFRn5Q4SmNrJmQRBDUhhW9r3JsjWiJs','2026-06-23T11:20:36.383Z'::timestamptz),
(479,2391,'UA7w1dZaSabvZrZmbx4k6zm2BuLow9N2cDuvvTP2YpzV','2026-06-21T21:55:46.237Z'::timestamptz),
(480,2682,'UULKeR8k6j1yGZpa6aBYJo9FNQjQ5xFX78xiEn4RHuya','2026-06-23T12:46:53.089Z'::timestamptz),
(481,766,'nVdrPN1x9sJDws1UwwHXSmSxDen32CfnYpr1svigsQHL','2026-06-23T21:35:21.193Z'::timestamptz),
(482,728,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-06-22T19:34:52.157Z'::timestamptz),
(483,4206,'HYfsQZGi1AYok3pK35i2CgwW4Y66Dc5cFV7Vg7smR7Wr','2026-06-24T20:01:27.147Z'::timestamptz),
(484,4978,'9aSSjAVD2UF2hq3Mi87cUGYF8NkMDEMkn3k6b1KD3izy','2026-06-26T23:41:18.418Z'::timestamptz),
(485,3242,'q665NR9RvT69nFwGnUF8ZY2MfjPXtw46i8uPUsUtgHNz','2026-06-24T11:11:24.658Z'::timestamptz),
(486,2840,'5DrvsWxE1YWoAbTDj6ZyHM2ouQqRWeppYb341YZb6Hbn','2026-06-26T16:44:14.505Z'::timestamptz),
(487,920,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-06-25T00:27:34.147Z'::timestamptz),
(488,39,'EcUf8HcSwQwEYYzYNmJjRFXKw1d1nZFkWKRbviHASHkB','2026-06-27T23:10:41.928Z'::timestamptz),
(489,330,'DWcHzMf1wZ7V9qWfdLp8fiiG2b81AncqwbJUdvTmN1JY','2026-06-25T02:41:26.864Z'::timestamptz),
(490,2908,'DM24Ytbddc1KAqcQywg7DMFNRghcwsJWahK21KZVZNmb','2026-06-28T14:39:11.131Z'::timestamptz),
(491,2102,'h4wVC2Zdu67rVHj4f3Txu3GbSDjMxSKSqifzq9kRBr9c','2026-06-27T04:27:25.561Z'::timestamptz),
(492,2441,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-06-28T05:03:51.073Z'::timestamptz),
(493,2173,'36LyTsbPoxuafWNtBvyyJ44iEv6U5Gv1Q2q2pwdRRKZD','2026-06-29T20:20:22.038Z'::timestamptz),
(494,792,'wJTFjs2Wm4R2sejeRCRoYkpPxiEcELeUu9jQhNedevQR','2026-06-29T04:33:04.078Z'::timestamptz),
(495,4061,'wu96k1PKjJxt84BF1u78W8R4goXjPNrFzPwFD9bHmu7E','2026-06-29T19:55:23.416Z'::timestamptz),
(496,3832,'g66VHjXcbpF7wAwkuMKcRSBWDgpzVW5x5KpXsAMP1dsr','2026-06-30T19:13:05.243Z'::timestamptz),
(497,2045,'cZFSA3twdYjiSYd2WAY82cHv4WG4br4G92AUu5MwzqyS','2026-06-30T10:31:19.257Z'::timestamptz),
(498,3932,'VQxbQ3TDHkMygGmtZ3qaNuDfvWQTp2S4h7v9p7J97Tbb','2026-06-30T00:12:32.384Z'::timestamptz),
(499,4043,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-06-30T12:55:06.478Z'::timestamptz),
(500,1513,'bdFsTR1renqEvoYEJbT8PApc7jan8EArMDU8nzSVKzVP','2026-07-01T13:45:25.874Z'::timestamptz),
(501,4626,'s8m5nczVtoogWZ7noUJNMMRD8gExLnV11GsLX9TxRtrA','2026-06-29T09:10:22.706Z'::timestamptz),
(502,1538,'BL8GmhJi6WKFHMa6UcmV6UZAxKdaTNcW9Whu1rtJzYrK','2026-06-30T19:26:20.527Z'::timestamptz),
(503,100,'p5oea3MWGxEszVPfcJ6sDNmPDYnUziaXNq14E2xtaVs6','2026-07-02T12:21:14.679Z'::timestamptz),
(504,386,'baQ45Ka6oLzGKxxgRRdSE2HbUHd9RkjXT4L5p8irmQuy','2026-07-03T18:35:54.110Z'::timestamptz),
(505,4932,'7QJX18yNi2EPhfiT9hT295V2hqA3FQ46zGvm3nM1YGDy','2026-07-02T01:39:56.841Z'::timestamptz),
(506,2505,'z9dCFKkwYimCW57dNWcysFZXWjhTe2T82abMp7Y1RCeQ','2026-07-01T04:11:07.287Z'::timestamptz),
(507,1019,'F1CLhnLYRivgPFy4ZGaCKPDoD4MqzLexdJdEGfEv5smE','2026-07-03T23:08:36.077Z'::timestamptz),
(508,2820,'LNRPGRzy7oosXiU5G95gesXTZUvd4uucAnf9ANxgZycK','2026-07-04T05:32:16.214Z'::timestamptz),
(509,334,'peYH6azmbqk1PboynBQNcBRZxUa7u3DJnXzFeFVXwYYW','2026-07-03T14:49:52.539Z'::timestamptz),
(510,2570,'Ki7sGTgPfaTWWVPhnmSQypacnQqfX36uYk81in7Mmnih','2026-07-02T20:51:15.847Z'::timestamptz),
(511,2434,'JXh99dYPCupQ4xMPkzFkFCUjWmfYv6RuKJy3NP42H4G1','2026-07-04T05:48:13.644Z'::timestamptz);

-- The seed's own view of the permutation, checked against the permutation. If
-- these disagree the generator and the reveal table were produced from different
-- runs, and the crew the app renders is not the crew this database thinks exists.
do $$
declare
  v_bad integer;
begin
  select count(*) into v_bad
    from genesis_crew g
    join public.reveal_order r on r.draw_position = g.draw_position
   where r.serial <> g.serial;
  if v_bad > 0 then
    raise exception '% genesis positions disagree with the reveal permutation', v_bad;
  end if;

  select count(*) into v_bad from genesis_crew;
  if v_bad <> 512 then
    raise exception 'genesis crew is % xployees, expected 512 (HIRED_COUNT)', v_bad;
  end if;
end;
$$;

-- Take the positions out of the pool.
update public.reveal_order r
   set claimed_by = g.owner,
       claimed_at = g.hired_at,
       claim_kind = 'genesis'
  from genesis_crew g
 where r.draw_position = g.draw_position;

-- And write the ownership. The stamping trigger moves `updated_at` for us; the
-- tier, skill count and principal are already correct from the seed and are not
-- restated, so this statement cannot contradict them.
update public.xployees x
   set owner     = g.owner,
       hired_at  = g.hired_at
  from genesis_crew g
 where x.id = g.serial;

-- ---------------------------------------------------------------------------
-- What the xNET now guarantees
-- ---------------------------------------------------------------------------
do $$
declare
  v_owned    integer;
  v_wallets  integer;
  v_pool     integer;
  v_next     integer;
begin
  select count(*) into v_owned from public.xployees where owner is not null;
  if v_owned <> 512 then
    raise exception '% xployees are owned, expected exactly the 512 genesis workers', v_owned;
  end if;

  select count(*) into v_wallets from public.wallets;
  if v_wallets <> 97 then
    raise exception 'the xNET seeded % wallets, expected 97', v_wallets;
  end if;

  -- Every genesis worker's owner is a wallet the directory can name. Not a
  -- foreign key on the table — a real mint must not require a profile row — but
  -- true of the seeded partition, and worth knowing it is.
  if exists (
    select 1 from public.xployees x
     where x.owner is not null
       and not exists (select 1 from public.wallets w where w.address = x.owner)
  ) then
    raise exception 'a genesis xployee is owned by a wallet the directory does not know';
  end if;

  -- Owned and unclaimed are the same set seen from two tables. A serial owned by
  -- somebody while its reveal position sits in the pool would be dealt again to
  -- the next buyer.
  if exists (
    select 1 from public.xployees x
     join public.reveal_order r on r.serial = x.id
    where (x.owner is not null) <> (r.claimed_at is not null)
  ) then
    raise exception 'ownership and the reveal pool disagree about at least one serial';
  end if;

  select count(*) into v_pool from public.reveal_order where claimed_at is null;
  if v_pool <> public.max_supply() - 512 then
    raise exception 'the mint pool holds % positions, expected %', v_pool, public.max_supply() - 512;
  end if;

  -- The first serial a real mint will be dealt. Stated out loud because it is the
  -- one number a reader can check by hand against `serialForMint(512)` in the
  -- browser, and because getting it wrong means the first buyer receives a worker
  -- somebody else is already looking at.
  select serial into v_next from public.reveal_order where claimed_at is null order by draw_position limit 1;
  if v_next <> 4228 then
    raise exception 'the next mint would be dealt serial %, but position 512 of the permutation is 4228', v_next;
  end if;
end;
$$;

-- Genesis hires are not mints, and this says so where a reader will trip over it.
comment on column public.reveal_order.claim_kind is
  'genesis = one of the 512 pre-hired workers the collection ships with; nobody burned for these and public.mints holds no row for them. reserved = held by a live mint reservation. minted = burned for, verified on chain, assigned.';

comment on column public.xployees.owner is
  'Null means UNMINTED, not unknown. Every serial exists from the seed; minting moves this from null to a wallet. Count mints in public.mints, not owners here — the 512 genesis workers are owned and were never minted.';


-- =========================================================================
-- SECTION 11 of 16 — 20260806090600_mint_control.sql
-- =========================================================================

-- xNFTs index — minting: the rate limit, the reservation, and the serial dealer.
--
-- ===========================================================================
-- THE THREAT
-- ===========================================================================
-- Rarity is positional and the supply is 5,000. At a low market cap, 10,000
-- $xNFT is cheap, so the attack is not clever: buy a pile of supply, mint in a
-- tight loop, and take the low serials before anybody else can get to them.
-- X-RATED is 150 units. A script that can mint once a second empties the rare
-- half of the reveal order in under an hour, and every honest buyer afterwards is
-- drawing from a pool somebody else has already picked over.
--
-- ===========================================================================
-- WHY THE LIMIT LIVES HERE AND NOWHERE ELSE
-- ===========================================================================
-- A client-side limit is not a limit. The mint transaction is a plain SPL
-- transfer that any wallet can build without this application's help, and the
-- Edge Function is reachable with a public anon key. The only party that sees
-- every request is Postgres, so the only place a limit can be enforced is
-- Postgres.
--
-- ===========================================================================
-- THE RULE THAT MAKES IT REAL, AND IT IS NOT THE OBVIOUS ONE
-- ===========================================================================
-- The limit is consumed when a serial is RESERVED, not when a burn is indexed.
--
-- That ordering is the whole design. A limit checked at ingest time is checked
-- after the tokens are already gone, so it cannot prevent anything — it can only
-- decide whether to hand over an xployee for a burn that already happened, which
-- is a refund problem rather than a rate limit. Worse, an attacker who does not
-- care about a pleasant experience simply skips the reservation and burns fifty
-- times in a row.
--
-- So both doors are closed, and they are closed with the same policy:
--
--   1. `reserve_mint` takes the rate limit and deals the serial BEFORE the buyer
--      burns anything. This is the limit. It is atomic, it is enforced by
--      constraints as well as by locks, and a refusal costs the caller nothing.
--   2. `record_mint` verifies the burn on chain and redeems that reservation. A
--      burn arriving with NO live reservation is dealt a serial only if the
--      policy would have allowed a reservation at that instant. Otherwise the
--      mint is still recorded — the tokens are gone and the chain says so, and a
--      backend that silently forgot a real burn would be stealing — but it is
--      recorded as `held`, with no serial, for the operator to resolve.
--
-- "Burn first, ask later" therefore buys an attacker nothing except burnt tokens
-- and a support ticket.
--
-- ===========================================================================
-- WHAT IS ACTUALLY ATOMIC, AND WHY EACH LAYER IS THERE
-- ===========================================================================
-- Not one check-then-insert anywhere. Five independent mechanisms, so that a bug
-- in any one of them still leaves the invariant standing:
--
--   1. `pg_advisory_xact_lock(MINT_GATE)` — one mint transaction at a time,
--      cluster-wide. Held to commit by the transaction that took it, so every
--      window count below is exact rather than a snapshot two callers can both
--      read as 99. The cost is that mints serialise; at a total supply of 5,000
--      that is not a cost worth optimising away for correctness.
--   2. `mint_reservations_one_live_per_wallet` — a partial UNIQUE index. Even
--      with the lock removed entirely, one wallet cannot hold two live
--      reservations. This is the constraint the brief asks for: not a check
--      somebody performs, a shape the data cannot take.
--   3. `mint_reservations_one_holder_per_position` / `_per_serial` — a serial can
--      be held by at most one reservation that still counts. Released positions
--      return to the pool and may legitimately appear again in a later row, which
--      is exactly why these are partial rather than plain uniques.
--   4. `for update skip locked` on the reveal pool — two concurrent dealers take
--      two different positions instead of racing for one. Redundant while the
--      gate lock is held; deliberately kept, because the day someone decides the
--      gate is too coarse, this is what stops the removal being a disaster.
--   5. `reveal_order.serial UNIQUE` — the permutation itself cannot contain a
--      duplicate, so "two mints received the same serial" is unrepresentable at
--      the storage layer no matter what every function above does.
--
-- ===========================================================================
-- CONFIGURABLE WITHOUT A CODE CHANGE
-- ===========================================================================
-- Every threshold is a column on `public.mint_policy`, a one-row table. An
-- operator changes a limit with an UPDATE from the dashboard; no deploy, no
-- migration, no function body edited. `paused` stops minting outright, which is
-- the control you want at 3am when something is going wrong and you do not yet
-- know what.
--
-- ===========================================================================
-- WHAT THIS DOES NOT DO
-- ===========================================================================
-- It does not stop a Sybil. Wallets are free, so a per-wallet cap is a cost
-- multiplier rather than a wall, and anyone claiming otherwise about a system
-- with no identity layer is selling something. What the GLOBAL cap does is bound
-- the RATE at which the collection can drain regardless of how many wallets are
-- involved — which converts "the rare serials were gone before anyone noticed"
-- into "the rare serials are draining and the operator has hours to respond".
-- That is the honest claim, and it is the one the numbers below are chosen for.

-- ---------------------------------------------------------------------------
-- The gate key
-- ---------------------------------------------------------------------------

-- An arbitrary but fixed advisory-lock key. A literal rather than
-- `hashtext('...')` so the value cannot change with a Postgres version or a
-- collation: every session must compute the same number or the mutex is not one.
create or replace function public.mint_gate_key()
returns bigint
language sql
immutable
parallel safe
set search_path = ''
as $$ select 7745110001::bigint $$;

comment on function public.mint_gate_key() is
  'Advisory lock key serialising the mint path. Any session taking it must use pg_advisory_xact_lock so it is released at commit or rollback — never pg_advisory_lock, which would survive a failed transaction and wedge minting until the connection died.';

-- ---------------------------------------------------------------------------
-- mint_policy — one row, every threshold
-- ---------------------------------------------------------------------------

create table public.mint_policy (
  -- Singleton by construction: a boolean primary key that must be true admits
  -- exactly one row, so there is no "which policy is in force" question to get
  -- wrong and no `where id = 1` to forget.
  id boolean primary key default true check (id),

  -- The kill switch. Checked first, before any counting, so it is also the
  -- fastest path through this file.
  paused       boolean not null default false,
  pause_reason text,

  -- Per wallet: the shortest gap between two reservations. Blunt, and blunt is
  -- the point — it turns a tight loop into a queue whatever else is true.
  wallet_cooldown_seconds integer not null default 90
    check (wallet_cooldown_seconds >= 0 and wallet_cooldown_seconds <= 86400),

  -- Per wallet: a rolling window and how many reservations fit in it. The window
  -- restarts from the first reservation in it rather than sliding continuously —
  -- cheaper, and the difference only ever favours the wallet.
  wallet_window_seconds integer not null default 86400 check (wallet_window_seconds > 0),
  wallet_window_limit   integer not null default 10    check (wallet_window_limit > 0),

  -- Across ALL wallets. This is the one that bounds the drain rate, and it is a
  -- true sliding window: every reservation created in the last
  -- `global_window_seconds` counts, whoever made it and whether or not they went
  -- on to burn. Abandoning a reservation therefore does not refund its budget,
  -- which is what stops reserve-and-drop being free.
  global_window_seconds integer not null default 3600 check (global_window_seconds > 0),
  global_window_limit   integer not null default 120  check (global_window_limit > 0),

  -- How long a reservation holds its serial before the position returns to the
  -- pool. Long enough to sign, send and confirm a Solana transaction several
  -- times over; short enough that an abandoned reservation is not a serial
  -- withdrawn from circulation for the afternoon.
  reservation_ttl_seconds integer not null default 900
    check (reservation_ttl_seconds >= 60 and reservation_ttl_seconds <= 3600),

  updated_at timestamptz not null default now(),
  -- Free text. Who changed it and why, for the operator's own benefit — nothing
  -- reads this.
  updated_note text
);

comment on table public.mint_policy is
  'Every mint threshold, in one row, changeable with an UPDATE. The defaults bound the drain rate at 120 serials/hour across the whole protocol and 10/day per wallet, with a 90-second floor between two reservations from one wallet.';
comment on column public.mint_policy.global_window_limit is
  'The number that actually protects the low serials. 120/hour against a 5,000 supply means the rarest 150 cannot be swept before an operator has had time to notice and pause.';
comment on column public.mint_policy.paused is
  'Refuses every new reservation immediately. Does NOT refuse an already-reserved burn — a buyer who has paid still gets their xployee, because pausing the mint must never become a way to take somebody''s tokens.';

insert into public.mint_policy (id) values (true);

-- ---------------------------------------------------------------------------
-- mint_rate_limits — the per-wallet counters
-- ---------------------------------------------------------------------------

create table public.mint_rate_limits (
  wallet public.base58_address primary key,

  -- The cooldown anchor. Set when a reservation is granted, not when a burn is
  -- indexed: the reservation is the scarce thing.
  last_reserved_at timestamptz,
  last_minted_at   timestamptz,

  -- The rolling window, as a start plus a count. Reset lazily on the next
  -- reservation rather than by a sweep, so there is no scheduled job whose
  -- failure quietly lifts the limit.
  window_started_at timestamptz not null default now(),
  window_count      integer not null default 0 check (window_count >= 0),

  lifetime_reservations integer not null default 0 check (lifetime_reservations >= 0),
  lifetime_mints        integer not null default 0 check (lifetime_mints >= 0),
  -- How often this wallet has been turned away. Not used by any decision; it is
  -- what tells an operator the difference between a busy day and somebody
  -- hammering the endpoint.
  refusals              integer not null default 0 check (refusals >= 0),

  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.mint_rate_limits is
  'Per-wallet mint budget. Read and written only under the advisory gate lock plus a FOR UPDATE row lock, so two simultaneous reservations from one wallet cannot both see the same count.';

-- ---------------------------------------------------------------------------
-- mint_reservations — a held serial
-- ---------------------------------------------------------------------------

create table public.mint_reservations (
  id            uuid primary key default gen_random_uuid(),
  wallet        public.base58_address not null,
  draw_position integer not null references public.reveal_order (draw_position) on delete restrict,
  serial        integer not null,

  --   live     — holding its serial, waiting for a burn.
  --   redeemed — a verified burn arrived and the serial was assigned.
  --   expired  — the TTL passed with no burn; the position went back to the pool.
  --   released — given up deliberately (an operator, or a client that cancelled).
  status text not null default 'live'
    check (status in ('live', 'redeemed', 'expired', 'released')),

  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  redeemed_at timestamptz,
  -- The signature of the burn that redeemed it. Unique, so one transaction cannot
  -- redeem two reservations.
  mint_signature public.tx_signature unique,

  constraint mint_reservations_expiry_after_creation check (expires_at > created_at),
  -- A redeemed reservation names the transaction that redeemed it; anything else
  -- names none. Without this, `status` and `mint_signature` could disagree and a
  -- reader would have to guess which one meant it.
  constraint mint_reservations_redeemed_has_evidence check (
    (status = 'redeemed' and mint_signature is not null and redeemed_at is not null)
    or (status <> 'redeemed' and mint_signature is null and redeemed_at is null)
  )
);

-- LAYER 2. One live reservation per wallet, enforced by the index rather than by
-- the function that maintains it. This is what makes "two simultaneous mints
-- cannot both pass" true independently of the lock.
create unique index mint_reservations_one_live_per_wallet
  on public.mint_reservations (wallet) where status = 'live';

-- LAYER 3. A position, and its serial, may be held by at most one reservation
-- that still counts. Partial rather than plain: an expired or released
-- reservation returns its position to the pool, and the next buyer taking that
-- same position is correct behaviour, not a duplicate.
create unique index mint_reservations_one_holder_per_position
  on public.mint_reservations (draw_position) where status in ('live', 'redeemed');
create unique index mint_reservations_one_holder_per_serial
  on public.mint_reservations (serial) where status in ('live', 'redeemed');

create index mint_reservations_window_idx on public.mint_reservations (created_at desc);
create index mint_reservations_wallet_idx on public.mint_reservations (wallet, created_at desc);
create index mint_reservations_expiry_idx on public.mint_reservations (expires_at) where status = 'live';

comment on table public.mint_reservations is
  'A serial held for a wallet that has not burned yet. Creating one is what consumes the rate limit; redeeming one is what a verified burn does. Every reservation ever created counts against the global window whatever became of it, so reserve-and-abandon costs budget rather than refunding it.';

-- ---------------------------------------------------------------------------
-- mints — the columns an assignment needs
-- ---------------------------------------------------------------------------

alter table public.mints
  add column if not exists reservation_id uuid references public.mint_reservations (id) on delete set null,
  -- 'assigned' — a serial was dealt and public.xployees.owner now names the buyer.
  -- 'held'     — the burn is verified and recorded, and no serial was dealt. The
  --              tokens are gone; this row is the buyer's receipt and the
  --              operator's queue.
  add column if not exists assignment_status text not null default 'assigned',
  add column if not exists held_reason text;

alter table public.mints
  add constraint mints_assignment_status_known
    check (assignment_status in ('assigned', 'held'));

-- The two states have to be legible from the row alone. An 'assigned' row with no
-- xployee is a mint that quietly gave nothing; a 'held' row WITH one is a mint
-- that gave something the ledger says it did not.
alter table public.mints
  add constraint mints_assignment_matches_serial check (
    (assignment_status = 'assigned' and xployee_id is not null)
    or (assignment_status = 'held' and xployee_id is null and held_reason is not null)
  );

-- A serial is minted once, ever. The reveal order already guarantees a position
-- is dealt once; this says the same thing from the ledger's side, so the two
-- would have to be broken together to produce a double-mint.
create unique index if not exists mints_serial_minted_once
  on public.mints (xployee_id) where xployee_id is not null;

comment on column public.mints.xployee_id is
  'The serial this burn bought. No longer null in practice: the buyer reserves a serial before burning and record_mint redeems that reservation, so the assignment is a database fact rather than something the transaction had to carry. Null only on a ''held'' row.';
comment on column public.mints.assignment_status is
  'assigned = a serial was dealt. held = the burn is real and recorded but the policy would not deal a serial for it; the operator resolves these by hand. A held row is never silently discarded — the tokens are already burned.';

-- ---------------------------------------------------------------------------
-- release_expired_reservations
-- ---------------------------------------------------------------------------

-- Returns held serials to the pool. Called at the top of every reservation, so
-- the pool is correct at the moment it matters without depending on a scheduled
-- job — a cron that stops running would otherwise leak the collection one
-- abandoned reservation at a time, invisibly.
--
-- Scheduling it as well is still worth doing (see supabase/README.md): it keeps
-- the pool honest during a quiet period, so `reveal_order` read by the mint page
-- does not show serials that are only notionally held.
create or replace function public.release_expired_reservations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_freed integer := 0;
begin
  with dead as (
    update public.mint_reservations r
       set status = 'expired'
     where r.status = 'live'
       and r.expires_at <= now()
    returning r.draw_position
  )
  update public.reveal_order o
     set claimed_by = null,
         claimed_at = null,
         claim_kind = null
    from dead
   where o.draw_position = dead.draw_position
     -- Only a position still held BY a reservation goes back. A position that has
     -- since been minted is not a reservation's to release, and the guard means a
     -- late sweep cannot un-assign a serial somebody already owns.
     and o.claim_kind = 'reserved';

  get diagnostics v_freed = row_count;
  return v_freed;
end;
$$;

-- ---------------------------------------------------------------------------
-- reserve_mint — THE RATE LIMIT
-- ---------------------------------------------------------------------------

-- Returns jsonb rather than raising, because a refusal is an ordinary outcome
-- that the UI has to render as a sentence: "you can mint again in four minutes"
-- is information, not an error. Raising would also roll back the very counter
-- updates a refusal ought to record.
--
--   { ok: true,  reservation: { id, serial, draw_position, expires_at }, pool_remaining }
--   { ok: false, code, message, retry_after_seconds }
--
-- Codes: 'mint-paused', 'cooldown', 'wallet-window', 'global-window', 'sold-out'.
create or replace function public.reserve_mint(p_wallet text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy   public.mint_policy;
  v_limits   public.mint_rate_limits;
  v_existing public.mint_reservations;
  v_res      public.mint_reservations;
  v_position integer;
  v_serial   integer;
  v_global   integer;
  v_oldest   timestamptz;
  v_retry    integer;
  v_pool     integer;
begin
  if p_wallet is null or p_wallet !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then
    return jsonb_build_object(
      'ok', false, 'code', 'bad-wallet',
      'message', 'That is not a base58 Solana address. Nothing was reserved.'
    );
  end if;

  -- LAYER 1. Everything from here to commit is serialised. Taken before the
  -- policy is read so a concurrent operator UPDATE cannot land between the read
  -- and the decision it informs.
  perform pg_advisory_xact_lock(public.mint_gate_key());

  select * into v_policy from public.mint_policy where id;

  -- Abandoned reservations first: a caller who is about to be told the pool is
  -- empty deserves to be told that about the real pool.
  perform public.release_expired_reservations();

  if v_policy.paused then
    return jsonb_build_object(
      'ok', false, 'code', 'mint-paused',
      'message', coalesce(v_policy.pause_reason, 'Minting is paused. Nothing was reserved and nothing was charged.')
    );
  end if;

  -- An existing live reservation is RETURNED, not refused. A client that lost the
  -- response, refreshed the page, or retried a timeout must get its own serial
  -- back rather than be told it is rate limited by itself. The partial unique
  -- index would refuse the second insert anyway; answering here turns that from a
  -- constraint violation into the correct answer.
  select * into v_existing
    from public.mint_reservations
   where wallet = p_wallet and status = 'live'
   limit 1;
  if found then
    select count(*) into v_pool from public.reveal_order where claimed_at is null;
    return jsonb_build_object(
      'ok', true,
      'reused', true,
      'reservation', jsonb_build_object(
        'id', v_existing.id,
        'serial', v_existing.serial,
        'serial_label', public.serial_label(v_existing.serial),
        'tier', public.tier_for_id(v_existing.serial),
        'draw_position', v_existing.draw_position,
        'expires_at', v_existing.expires_at
      ),
      'pool_remaining', v_pool
    );
  end if;

  -- The per-wallet row. `insert ... on conflict do nothing` then `select ... for
  -- update` rather than a bare select: a wallet minting for the first time has no
  -- row, and two of its requests arriving together would otherwise both find
  -- nothing and both insert.
  insert into public.mint_rate_limits (wallet) values (p_wallet) on conflict (wallet) do nothing;
  select * into v_limits from public.mint_rate_limits where wallet = p_wallet for update;

  -- Cooldown.
  if v_limits.last_reserved_at is not null
     and v_limits.last_reserved_at + make_interval(secs => v_policy.wallet_cooldown_seconds) > now() then
    v_retry := ceil(extract(epoch from (
      v_limits.last_reserved_at + make_interval(secs => v_policy.wallet_cooldown_seconds) - now()
    )))::integer;
    update public.mint_rate_limits set refusals = refusals + 1, updated_at = now() where wallet = p_wallet;
    return jsonb_build_object(
      'ok', false, 'code', 'cooldown',
      'message', format('This wallet reserved a serial less than %s seconds ago. Nothing was reserved.',
                        v_policy.wallet_cooldown_seconds),
      'retry_after_seconds', v_retry
    );
  end if;

  -- Roll the window over if it has aged out. Lazily, so nothing depends on a
  -- sweep having run.
  if v_limits.window_started_at + make_interval(secs => v_policy.wallet_window_seconds) <= now() then
    update public.mint_rate_limits
       set window_started_at = now(), window_count = 0, updated_at = now()
     where wallet = p_wallet
    returning * into v_limits;
  end if;

  if v_limits.window_count >= v_policy.wallet_window_limit then
    v_retry := ceil(extract(epoch from (
      v_limits.window_started_at + make_interval(secs => v_policy.wallet_window_seconds) - now()
    )))::integer;
    update public.mint_rate_limits set refusals = refusals + 1, updated_at = now() where wallet = p_wallet;
    return jsonb_build_object(
      'ok', false, 'code', 'wallet-window',
      'message', format('This wallet has reserved %s serials in the last %s seconds, which is its limit. Nothing was reserved.',
                        v_limits.window_count, v_policy.wallet_window_seconds),
      'retry_after_seconds', greatest(v_retry, 1)
    );
  end if;

  -- The global window. A true sliding count over every reservation created in it,
  -- whatever became of that reservation — see the table comment for why an
  -- abandoned one still costs budget.
  select count(*), min(created_at) into v_global, v_oldest
    from public.mint_reservations
   where created_at > now() - make_interval(secs => v_policy.global_window_seconds);

  if v_global >= v_policy.global_window_limit then
    v_retry := greatest(1, ceil(extract(epoch from (
      v_oldest + make_interval(secs => v_policy.global_window_seconds) - now()
    )))::integer);
    update public.mint_rate_limits set refusals = refusals + 1, updated_at = now() where wallet = p_wallet;
    return jsonb_build_object(
      'ok', false, 'code', 'global-window',
      'message', format('The protocol has issued %s serials in the last %s seconds, which is the ceiling across all wallets. Nothing was reserved.',
                        v_global, v_policy.global_window_seconds),
      'retry_after_seconds', v_retry
    );
  end if;

  -- LAYER 4. Deal the lowest position still in the pool. `for update skip locked`
  -- inside the subquery so two dealers take two rows; `claimed_at is null` in the
  -- outer predicate as well, so a row that was claimed between the pick and the
  -- write updates nothing rather than overwriting somebody's claim.
  update public.reveal_order o
     set claimed_by = p_wallet,
         claimed_at = now(),
         claim_kind = 'reserved'
   where o.draw_position = (
     select i.draw_position
       from public.reveal_order i
      where i.claimed_at is null
      order by i.draw_position
      limit 1
      for update skip locked
   )
     and o.claimed_at is null
  returning o.draw_position, o.serial into v_position, v_serial;

  if v_position is null then
    return jsonb_build_object(
      'ok', false, 'code', 'sold-out',
      'message', 'Every serial in the collection has been dealt. Nothing was reserved.'
    );
  end if;

  insert into public.mint_reservations (wallet, draw_position, serial, expires_at)
  values (p_wallet, v_position, v_serial, now() + make_interval(secs => v_policy.reservation_ttl_seconds))
  returning * into v_res;

  update public.mint_rate_limits
     set last_reserved_at      = now(),
         window_count          = window_count + 1,
         lifetime_reservations = lifetime_reservations + 1,
         updated_at            = now()
   where wallet = p_wallet;

  select count(*) into v_pool from public.reveal_order where claimed_at is null;

  return jsonb_build_object(
    'ok', true,
    'reused', false,
    'reservation', jsonb_build_object(
      'id', v_res.id,
      'serial', v_res.serial,
      'serial_label', public.serial_label(v_res.serial),
      'tier', public.tier_for_id(v_res.serial),
      'draw_position', v_res.draw_position,
      'expires_at', v_res.expires_at
    ),
    'pool_remaining', v_pool
  );
end;
$$;

comment on function public.reserve_mint(text) is
  'THE rate limit. Takes the wallet''s budget and deals a serial before any burn happens. Returns jsonb — a refusal is an outcome the UI renders, not an exception.';

-- ---------------------------------------------------------------------------
-- release_mint_reservation
-- ---------------------------------------------------------------------------

-- A wallet giving up its own hold. Returns the position to the pool immediately
-- instead of waiting out the TTL — but deliberately does NOT refund the rate
-- limit, because a refund would make reserve/cancel/reserve a free way to reroll
-- a serial until a rare one came up. The reveal order is a lottery, and a lottery
-- you can redraw is not one.
create or replace function public.release_mint_reservation(p_wallet text, p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_position integer;
begin
  perform pg_advisory_xact_lock(public.mint_gate_key());

  update public.mint_reservations r
     set status = 'released'
   where r.id = p_reservation_id
     and r.wallet = p_wallet
     and r.status = 'live'
  returning r.draw_position into v_position;

  if v_position is null then
    return jsonb_build_object(
      'ok', false, 'code', 'not-found',
      'message', 'No live reservation of that id belongs to this wallet. Nothing was changed.'
    );
  end if;

  update public.reveal_order
     set claimed_by = null, claimed_at = null, claim_kind = null
   where draw_position = v_position and claim_kind = 'reserved';

  return jsonb_build_object('ok', true, 'released', v_position);
end;
$$;

-- ---------------------------------------------------------------------------
-- record_mint — the chain-verified write
-- ---------------------------------------------------------------------------

-- Called by `ingest-signature` and by nothing else. Every argument was read out
-- of a transaction that function fetched from RPC itself; none of them came from
-- a browser.
--
-- No `p_fee`. A mint is one transfer to the incinerator and pays nobody — see
-- 20260806090000, which nails `mints.fee` to zero so the absence is enforced
-- rather than assumed.
--
-- THE ORDER OF THE BRANCHES IS THE POLICY:
--
--   1. Already indexed? Return what was decided last time. Idempotent per
--      (signature, event_index) at the primary key, so a replay cannot deal a
--      second serial and cannot flip a held row to assigned.
--   2. A live reservation for this buyer? Redeem it. This is the honest path and
--      the only one that should ever run in practice.
--   3. No reservation, but the policy would allow one right now? Deal a serial
--      and charge the budget for it. Covers the buyer whose reservation expired
--      while their transaction was confirming.
--   4. Otherwise: record the burn as `held`. The tokens are gone and the chain
--      says so — refusing to write the row would be the backend forgetting real
--      money — but no serial is dealt, so "burn first, ask later" cannot outrun
--      the limit.
create or replace function public.record_mint(
  p_signature   text,
  p_event_index integer,
  p_slot        bigint,
  p_block_time  timestamptz,
  p_buyer       text,
  p_burned      text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing  public.mints;
  v_res       public.mint_reservations;
  v_policy    public.mint_policy;
  v_limits    public.mint_rate_limits;
  v_global    integer;
  v_position  integer;
  v_serial    integer;
  v_hired     timestamptz := coalesce(p_block_time, now());
  v_held      text;
begin
  perform pg_advisory_xact_lock(public.mint_gate_key());

  -- 1. Replay.
  select * into v_existing
    from public.mints
   where signature = p_signature and event_index = p_event_index;
  if found then
    return jsonb_build_object(
      'ok', true, 'outcome', 'duplicate',
      'assignment_status', v_existing.assignment_status,
      'xployee_id', v_existing.xployee_id,
      'serial_label', case when v_existing.xployee_id is null then null
                           else public.serial_label(v_existing.xployee_id) end
    );
  end if;

  select * into v_policy from public.mint_policy where id;
  perform public.release_expired_reservations();

  -- 2. Redeem the buyer's own hold. Ordered by expiry so the one closest to
  -- lapsing is settled first; there can only be one live row per wallet, so the
  -- ordering is belt and braces rather than a real choice.
  select * into v_res
    from public.mint_reservations
   where wallet = p_buyer and status = 'live'
   order by expires_at
   limit 1;

  if found then
    v_position := v_res.draw_position;
    v_serial   := v_res.serial;
    update public.mint_reservations
       set status = 'redeemed', redeemed_at = now(), mint_signature = p_signature
     where id = v_res.id;
  else
    -- 3. No hold. Would the policy have granted one at this instant?
    if v_policy.paused then
      v_held := 'Minting was paused when this burn was indexed, and no serial was held for this wallet.';
    else
      insert into public.mint_rate_limits (wallet) values (p_buyer) on conflict (wallet) do nothing;
      select * into v_limits from public.mint_rate_limits where wallet = p_buyer for update;

      if v_limits.window_started_at + make_interval(secs => v_policy.wallet_window_seconds) <= now() then
        update public.mint_rate_limits
           set window_started_at = now(), window_count = 0, updated_at = now()
         where wallet = p_buyer
        returning * into v_limits;
      end if;

      select count(*) into v_global
        from public.mint_reservations
       where created_at > now() - make_interval(secs => v_policy.global_window_seconds);

      -- The cooldown is NOT applied here. It exists to stop a loop from forming,
      -- and a burn that has already landed is not a loop that can be stopped —
      -- charging a buyer for being 80 seconds early would take their tokens over
      -- a timing rule that has nothing left to protect. The two window caps ARE
      -- applied, because those are the ceilings that bound the drain.
      if v_limits.window_count >= v_policy.wallet_window_limit then
        v_held := format('This wallet has already taken %s of its %s serials for the current window.',
                         v_limits.window_count, v_policy.wallet_window_limit);
      elsif v_global >= v_policy.global_window_limit then
        v_held := format('The protocol issued %s serials in the last %s seconds, which is the ceiling across all wallets.',
                         v_global, v_policy.global_window_seconds);
      else
        update public.reveal_order o
           set claimed_by = p_buyer, claimed_at = now(), claim_kind = 'reserved'
         where o.draw_position = (
           select i.draw_position from public.reveal_order i
            where i.claimed_at is null
            order by i.draw_position
            limit 1
            for update skip locked
         )
           and o.claimed_at is null
        returning o.draw_position, o.serial into v_position, v_serial;

        if v_position is null then
          v_held := 'Every serial in the collection had been dealt when this burn was indexed.';
        else
          -- Recorded as a reservation redeemed in the same breath, so the audit
          -- trail is the same shape whichever branch produced it and the global
          -- window sees this serial the way it sees every other.
          insert into public.mint_reservations
            (wallet, draw_position, serial, expires_at, status, redeemed_at, mint_signature)
          values
            (p_buyer, v_position, v_serial,
             now() + make_interval(secs => v_policy.reservation_ttl_seconds),
             'redeemed', now(), p_signature)
          returning * into v_res;

          update public.mint_rate_limits
             set last_reserved_at      = now(),
                 window_count          = window_count + 1,
                 lifetime_reservations = lifetime_reservations + 1,
                 updated_at            = now()
           where wallet = p_buyer;
        end if;
      end if;
    end if;
  end if;

  -- 4. Write the mint, whichever way it went.
  if v_serial is null then
    insert into public.mints (
      signature, event_index, buyer, burned, slot, block_time,
      assignment_status, held_reason
    ) values (
      p_signature, p_event_index, p_buyer, p_burned, p_slot, p_block_time,
      'held', coalesce(v_held, 'No serial could be assigned to this burn.')
    );

    insert into public.mint_rate_limits (wallet) values (p_buyer) on conflict (wallet) do nothing;
    update public.mint_rate_limits
       set refusals = refusals + 1, updated_at = now()
     where wallet = p_buyer;

    return jsonb_build_object(
      'ok', true, 'outcome', 'inserted',
      'assignment_status', 'held',
      'held_reason', coalesce(v_held, 'No serial could be assigned to this burn.'),
      'xployee_id', null
    );
  end if;

  update public.reveal_order
     set claim_kind = 'minted', claimed_by = p_buyer
   where draw_position = v_position;

  update public.xployees
     set owner          = p_buyer,
         hired_at       = v_hired,
         mint_signature = p_signature
   where id = v_serial;

  insert into public.mints (
    signature, event_index, buyer, burned, xployee_id, slot, block_time,
    reservation_id, assignment_status
  ) values (
    p_signature, p_event_index, p_buyer, p_burned, v_serial, p_slot, p_block_time,
    v_res.id, 'assigned'
  );

  update public.mint_rate_limits
     set last_minted_at = now(),
         lifetime_mints = lifetime_mints + 1,
         updated_at     = now()
   where wallet = p_buyer;

  return jsonb_build_object(
    'ok', true, 'outcome', 'inserted',
    'assignment_status', 'assigned',
    'xployee_id', v_serial,
    'serial_label', public.serial_label(v_serial),
    'tier', public.tier_for_id(v_serial)
  );
end;
$$;

comment on function public.record_mint(text, integer, bigint, timestamptz, text, text) is
  'The chain-verified mint writer. Every argument comes from a transaction ingest-signature fetched itself. Idempotent per (signature, event_index); never discards a real burn, and never deals a serial the policy would have refused.';

-- ---------------------------------------------------------------------------
-- mint_availability — what the mint page needs to say
-- ---------------------------------------------------------------------------

-- Read-only. Answers "can this wallet mint, and if not, when?" without taking
-- any budget, so a page can poll it.
create or replace function public.mint_availability(p_wallet text default null)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_policy public.mint_policy;
  v_limits public.mint_rate_limits;
  v_res    public.mint_reservations;
  v_pool   integer;
  v_global integer;
  v_wait   integer := 0;
  v_code   text := 'ready';
begin
  select * into v_policy from public.mint_policy where id;
  select count(*) into v_pool from public.reveal_order where claimed_at is null;
  select count(*) into v_global
    from public.mint_reservations
   where created_at > now() - make_interval(secs => v_policy.global_window_seconds);

  if v_policy.paused then
    v_code := 'mint-paused';
  elsif v_pool = 0 then
    v_code := 'sold-out';
  elsif v_global >= v_policy.global_window_limit then
    v_code := 'global-window';
  end if;

  if p_wallet is not null then
    select * into v_limits from public.mint_rate_limits where wallet = p_wallet;
    select * into v_res
      from public.mint_reservations
     where wallet = p_wallet and status = 'live' and expires_at > now()
     limit 1;

    if v_code = 'ready' and v_limits.wallet is not null then
      if v_limits.last_reserved_at is not null
         and v_limits.last_reserved_at + make_interval(secs => v_policy.wallet_cooldown_seconds) > now() then
        v_code := 'cooldown';
        v_wait := ceil(extract(epoch from (
          v_limits.last_reserved_at + make_interval(secs => v_policy.wallet_cooldown_seconds) - now())))::integer;
      elsif v_limits.window_started_at + make_interval(secs => v_policy.wallet_window_seconds) > now()
        and v_limits.window_count >= v_policy.wallet_window_limit then
        v_code := 'wallet-window';
        v_wait := ceil(extract(epoch from (
          v_limits.window_started_at + make_interval(secs => v_policy.wallet_window_seconds) - now())))::integer;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'code', v_code,
    'paused', v_policy.paused,
    'pool_remaining', v_pool,
    'supply', public.max_supply(),
    'retry_after_seconds', greatest(v_wait, 0),
    'global_window_seconds', v_policy.global_window_seconds,
    'global_window_limit', v_policy.global_window_limit,
    'global_window_used', v_global,
    'wallet_window_seconds', v_policy.wallet_window_seconds,
    'wallet_window_limit', v_policy.wallet_window_limit,
    'wallet_window_used', coalesce(v_limits.window_count, 0),
    'wallet_cooldown_seconds', v_policy.wallet_cooldown_seconds,
    'reservation', case when v_res.id is null then null else jsonb_build_object(
      'id', v_res.id,
      'serial', v_res.serial,
      'serial_label', public.serial_label(v_res.serial),
      'tier', public.tier_for_id(v_res.serial),
      'expires_at', v_res.expires_at
    ) end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Execution grants
-- ---------------------------------------------------------------------------

-- Same rule as 20260805120100: PostgREST resolves /rpc/<fn> through the caller's
-- role, so revoking EXECUTE from anon is what stops the public key calling a
-- writer directly. `mint_availability` is read-only and would be harmless in anon
-- hands — it is still closed, because "harmless today" is how a read function
-- acquires a write branch six months later, and the Edge Function that needs it
-- already has the service role.
revoke all on function public.mint_gate_key() from public, anon, authenticated;
revoke all on function public.release_expired_reservations() from public, anon, authenticated;
revoke all on function public.reserve_mint(text) from public, anon, authenticated;
revoke all on function public.release_mint_reservation(text, uuid) from public, anon, authenticated;
revoke all on function public.record_mint(text, integer, bigint, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.mint_availability(text) from public, anon, authenticated;

-- `stamp_xployee_identity` is deliberately NOT revoked. It is a trigger function
-- and nothing can call it directly — a trigger has no argument list to invoke —
-- while revoking EXECUTE from PUBLIC on a trigger function is a known way to
-- produce "permission denied for function" from an ordinary write. Closing a door
-- that does not exist at the cost of one that does is a bad trade.

grant execute on function public.release_expired_reservations() to service_role;
grant execute on function public.reserve_mint(text) to service_role;
grant execute on function public.release_mint_reservation(text, uuid) to service_role;
grant execute on function public.record_mint(text, integer, bigint, timestamptz, text, text) to service_role;
grant execute on function public.mint_availability(text) to service_role;

-- The pure helpers stay callable by everyone: they read nothing, write nothing,
-- and a policy or a generated column that calls them has to be able to.
grant execute on function public.max_supply() to public;
grant execute on function public.tier_for_id(bigint) to public;
grant execute on function public.skills_for_tier(text) to public;
grant execute on function public.serial_label(bigint) to public;


-- =========================================================================
-- SECTION 12 of 16 — 20260806090700_identity.sql
-- =========================================================================

-- xNFTs index — identity: profiles, verified X handles, and wallet linking.
--
-- ===========================================================================
-- THE ONE RULE
-- ===========================================================================
-- An X handle is stored ONLY when it came out of a verified OAuth identity.
-- There is no code path that accepts a typed one, and that is enforced three
-- ways rather than asserted once:
--
--   1. `set_profile` — the writer a user's own edits go through — HAS NO
--      TWITTER PARAMETER. Not an ignored one, not a validated one: the argument
--      list does not contain a place to put a handle. A caller that wants to set
--      one has nothing to send it in, and a future contributor who adds one has
--      to change a function signature, which is a visible act.
--   2. `link_twitter_identity` takes an `auth.users` id and reads the handle out
--      of `auth.identities` itself. The handle is a value GoTrue wrote after
--      completing the OAuth exchange with X; nothing the browser sends reaches
--      that column.
--   3. `profiles_twitter_is_verified` — a check constraint making a handle
--      without a provider id, a verification timestamp AND an auth user
--      unrepresentable. Even a service-role INSERT cannot write a bare handle.
--
-- ===========================================================================
-- LINKING PROVES BOTH SIDES
-- ===========================================================================
-- A link is a claim about two things at once — "this X account and this Solana
-- wallet are the same person" — so one proof is not enough. Proving only the X
-- side lets anyone attach a stranger's wallet to their own account and inherit
-- its collection on every leaderboard. Proving only the wallet side lets anyone
-- attach a stranger's X handle to their own wallet and impersonate them.
--
--   X side      — a Supabase Auth session carrying a `twitter` identity. GoTrue
--                 completed the OAuth exchange; the browser cannot fabricate it.
--   Wallet side — an ed25519 signature, made by the wallet's own key, over a
--                 nonce THIS SERVER issued. Not a nonce the client chose: a
--                 client-chosen nonce is a signature an attacker can have
--                 collected somewhere else and replayed.
--
-- Both are consumed in one call. `complete_wallet_link` is reachable only by the
-- service role, and it is called only after `link-wallet` has verified the
-- signature — the same trust shape as `record_mint`, which the database also
-- takes on faith from a function that did the checking. The database's job is to
-- make the *result* unforgeable and unrepeatable; the Edge Function's job is to
-- do the cryptography. Neither can cover for the other.
--
-- ===========================================================================
-- WHY IDENTITY IS NEEDED AT ALL
-- ===========================================================================
-- Every social and marketplace writer after this migration has to answer "who is
-- acting?" without believing a request body. `public.actor_wallet(uid)` is that
-- answer: it resolves a session to the wallet that PROVED it owns that session,
-- so no writer ever takes a wallet address as a parameter from a caller. That is
-- the same discipline as "destinations read from configuration, never caller
-- parameters", applied to identity instead of to money.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  wallet public.base58_address primary key,

  -- Display name. User-typed and deliberately so — it is a nickname, not a claim
  -- about anything outside this application. Same shape as USERNAME_RE in
  -- src/lib/profile.ts.
  handle text check (handle is null or handle ~ '^[A-Za-z0-9_]{3,20}$'),
  bio    text check (bio is null or length(bio) <= 160),

  -- One of the owner's own xployees, rendered as their avatar. Not a foreign key
  -- with a cascade: an xployee is never deleted, and a sold one should leave a
  -- stale avatar to be corrected rather than a profile that vanished.
  avatar_xployee_id bigint references public.xployees (id) on delete set null,

  -- ---- the verified half ----
  --
  -- All four move together or not at all. `twitter_user_id` is X's numeric id,
  -- which is what actually identifies an account — a handle can be released and
  -- taken by somebody else, and a link keyed on the handle would silently follow
  -- it to the new owner.
  twitter_user_id     text unique,
  twitter_handle      text check (twitter_handle is null or twitter_handle ~ '^[A-Za-z0-9_]{1,15}$'),
  twitter_verified_at timestamptz,
  auth_user_id        uuid unique references auth.users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- THE CONSTRAINT THAT MAKES "VERIFIED ONLY" STRUCTURAL. A handle exists if and
  -- only if the provider id, the verification timestamp and the auth user all
  -- exist alongside it. There is no arrangement of columns that spells "handle
  -- somebody typed".
  constraint profiles_twitter_is_verified check (
    (twitter_handle is null and twitter_user_id is null and twitter_verified_at is null)
    or (twitter_handle is not null and twitter_user_id is not null
        and twitter_verified_at is not null and auth_user_id is not null)
  )
);

-- Handles are compared the way people read them. A unique index on lower() rather
-- than a unique column, so 'Deskrunner' cannot be registered next to 'deskrunner'
-- and used to impersonate it.
create unique index profiles_handle_ci_idx on public.profiles (lower(handle)) where handle is not null;
create index profiles_twitter_idx on public.profiles (lower(twitter_handle)) where twitter_handle is not null;

comment on table public.profiles is
  'Per-wallet profile. handle and bio are user-typed; twitter_handle is copied out of a verified OAuth identity by link_twitter_identity and can be written no other way — see profiles_twitter_is_verified.';
comment on column public.profiles.twitter_handle is
  'VERIFIED ONLY. Copied from auth.identities.identity_data after GoTrue completed the OAuth exchange with X. No writer in this schema accepts a handle as an argument.';
comment on column public.profiles.twitter_user_id is
  'X''s numeric account id. The link is keyed on this rather than on the handle, because a handle can be released and re-registered by somebody else and a handle-keyed link would follow it.';

-- ---------------------------------------------------------------------------
-- wallet_identities — the proof, kept
-- ---------------------------------------------------------------------------

-- The evidence behind a link, separate from the profile that displays it. Kept
-- because a link is a security assertion and an assertion with no record of what
-- justified it cannot be audited or revoked with confidence.
create table public.wallet_identities (
  wallet          public.base58_address primary key,
  auth_user_id    uuid not null unique references auth.users (id) on delete cascade,
  provider        text not null default 'twitter' check (provider = 'twitter'),
  twitter_user_id text not null unique,
  twitter_handle  text not null,
  -- The exact nonce that was signed, and the signature over it. Kept so a
  -- disputed link can be re-verified offline from this row alone.
  proof_nonce     text not null unique,
  proof_signature text not null,
  linked_at       timestamptz not null default now()
);

comment on table public.wallet_identities is
  'One wallet to one X account, unique in both directions. Holds the nonce and signature that proved the wallet side, so a link can be re-verified from the row rather than taken on trust.';

-- ---------------------------------------------------------------------------
-- wallet_link_challenges — the nonce
-- ---------------------------------------------------------------------------

-- A nonce is a secret until it is used, so this is the one table in the schema
-- that anon cannot read at all (see 20260806091100). Publishing the statement a
-- wallet is about to sign would not break the scheme by itself — the signature
-- is what matters — but a readable challenge table hands an attacker every
-- in-flight link attempt and the wallet each one is for.
create table public.wallet_link_challenges (
  nonce        text primary key check (length(nonce) between 32 and 128),
  wallet       public.base58_address not null,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  -- The exact text the wallet signs. Stored rather than recomputed so
  -- verification compares against the bytes that were actually issued — a
  -- statement rebuilt at verification time from a template is a statement that
  -- can be rebuilt differently.
  statement    text not null,
  issued_at    timestamptz not null default now(),
  expires_at   timestamptz not null,
  consumed_at  timestamptz,
  constraint wallet_link_challenges_expiry check (expires_at > issued_at)
);

create index wallet_link_challenges_user_idx on public.wallet_link_challenges (auth_user_id, issued_at desc);
create index wallet_link_challenges_sweep_idx on public.wallet_link_challenges (expires_at) where consumed_at is null;

comment on table public.wallet_link_challenges is
  'Server-issued nonces for wallet proof-of-ownership. Single use: consumed_at is set inside the same transaction that writes the link, so a replayed signature finds a spent challenge.';

-- ---------------------------------------------------------------------------
-- wallets.twitter — closed
-- ---------------------------------------------------------------------------

-- `public.wallets` predates this migration and carries a free-text `twitter`
-- column that any writer could once have filled in with anything. It is now a
-- mirror of the verified handle and nothing else, enforced by a trigger because a
-- check constraint cannot look at another table.
--
-- The column is kept rather than dropped for the same reason `mints.fee` was:
-- `src/lib/supabase.ts` maps it, and a dropped column changes the shape
-- PostgREST returns. What changes is that it can no longer hold a claim.
create or replace function public.guard_wallet_twitter()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.twitter is not null and not exists (
    select 1 from public.profiles p
     where p.wallet = new.address
       and p.twitter_handle = new.twitter
       and p.twitter_verified_at is not null
  ) then
    raise exception 'wallets.twitter mirrors a verified X handle from public.profiles; it cannot be set to a value nobody proved';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger wallets_twitter_must_be_verified
  before insert or update on public.wallets
  for each row execute function public.guard_wallet_twitter();

comment on column public.wallets.twitter is
  'A MIRROR of profiles.twitter_handle, maintained by link_twitter_identity. The wallets_twitter_must_be_verified trigger refuses any value that is not a verified handle already on the matching profile.';

-- ---------------------------------------------------------------------------
-- actor_wallet — who is acting
-- ---------------------------------------------------------------------------

-- The single answer to "which wallet is this session?" Every writer in the
-- migrations after this one calls it and none of them takes a wallet address as
-- a parameter, so there is no writer a caller can point at somebody else's
-- holdings.
--
-- Returns null rather than raising when the session has no linked wallet: an
-- unlinked user is an ordinary state (they signed in with X and have not proved a
-- wallet yet), and the callers turn it into a typed refusal with a sentence
-- attached.
create or replace function public.actor_wallet(p_user_id uuid)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select wallet from public.wallet_identities where auth_user_id = p_user_id
$$;

comment on function public.actor_wallet(uuid) is
  'Resolves an auth session to the wallet that proved it owns that session. The only sanctioned way for a writer to learn who is acting — never take a wallet from a request body.';

-- ---------------------------------------------------------------------------
-- set_profile — the user-typed half
-- ---------------------------------------------------------------------------

-- NOTE THE ARGUMENT LIST. There is no twitter parameter and there must never be
-- one. Adding it is the single change that would break the guarantee at the top
-- of this file, so it is called out here where anyone editing the signature will
-- read it.
--
-- The wallet is resolved from the session, not passed. An avatar has to be an
-- xployee the wallet actually owns, checked here rather than in the client,
-- because "show me as somebody else's X-RATED" is exactly the kind of harmless
-- little lie that a leaderboard makes not harmless.
create or replace function public.set_profile(
  p_user_id uuid,
  p_handle  text,
  p_bio     text,
  p_avatar_xployee_id bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet text;
  v_handle text := nullif(btrim(coalesce(p_handle, '')), '');
  v_bio    text := nullif(btrim(coalesce(p_bio, '')), '');
begin
  v_wallet := public.actor_wallet(p_user_id);
  if v_wallet is null then
    return jsonb_build_object(
      'ok', false, 'code', 'no-wallet',
      'message', 'This session has no linked wallet. Prove the wallet first; nothing was saved.'
    );
  end if;

  if v_handle is not null and v_handle !~ '^[A-Za-z0-9_]{3,20}$' then
    return jsonb_build_object(
      'ok', false, 'code', 'bad-handle',
      'message', 'A handle is 3–20 characters: letters, numbers or underscore. Nothing was saved.'
    );
  end if;
  if v_bio is not null and length(v_bio) > 160 then
    return jsonb_build_object(
      'ok', false, 'code', 'bad-bio',
      'message', 'A bio is 160 characters or fewer. Nothing was saved.'
    );
  end if;

  if p_avatar_xployee_id is not null and not exists (
    select 1 from public.xployees x where x.id = p_avatar_xployee_id and x.owner = v_wallet
  ) then
    return jsonb_build_object(
      'ok', false, 'code', 'avatar-not-owned',
      'message', 'An avatar has to be an xployee this wallet owns. Nothing was saved.'
    );
  end if;

  if v_handle is not null and exists (
    select 1 from public.profiles p
     where lower(p.handle) = lower(v_handle) and p.wallet <> v_wallet
  ) then
    return jsonb_build_object(
      'ok', false, 'code', 'handle-taken',
      'message', 'That handle belongs to another wallet. Nothing was saved.'
    );
  end if;

  insert into public.profiles (wallet, handle, bio, avatar_xployee_id)
  values (v_wallet, v_handle, v_bio, p_avatar_xployee_id)
  on conflict (wallet) do update
     set handle            = excluded.handle,
         bio               = excluded.bio,
         avatar_xployee_id = excluded.avatar_xployee_id,
         updated_at        = now();

  -- Mirror into public.wallets, which is what src/lib/supabase.ts reads today.
  -- One transaction, so the two cannot end up describing different people.
  insert into public.wallets (address, handle, bio)
  values (v_wallet, v_handle, v_bio)
  on conflict (address) do update
     set handle = excluded.handle,
         bio    = excluded.bio;

  return jsonb_build_object('ok', true, 'wallet', v_wallet, 'handle', v_handle);
end;
$$;

-- ---------------------------------------------------------------------------
-- Wallet linking
-- ---------------------------------------------------------------------------

-- Step one: issue the nonce.
--
-- The nonce comes from the Edge Function's CSPRNG rather than from
-- `gen_random_uuid()` here, so that the value the wallet signs and the value the
-- verifier compares against travel together through one piece of code. The TTL is
-- short — a challenge is a thing you answer in the next minute, and a long-lived
-- one is a signature an attacker has longer to obtain by other means.
create or replace function public.issue_wallet_link_challenge(
  p_user_id     uuid,
  p_wallet      text,
  p_nonce       text,
  p_statement   text,
  p_ttl_seconds integer default 300
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_wallet is null or p_wallet !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then
    return jsonb_build_object('ok', false, 'code', 'bad-wallet',
      'message', 'That is not a base58 Solana address. No challenge was issued.');
  end if;

  -- A wallet already linked to somebody else is refused before a challenge is
  -- even issued, so the failure is a sentence rather than a signature the user
  -- made for nothing.
  if exists (
    select 1 from public.wallet_identities w
     where w.wallet = p_wallet and w.auth_user_id <> p_user_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'wallet-linked',
      'message', 'That wallet is already linked to a different X account. No challenge was issued.');
  end if;

  -- Older open challenges for this session are burned. A user who started a link
  -- twice should not leave a spare valid nonce lying around behind them.
  update public.wallet_link_challenges
     set consumed_at = now()
   where auth_user_id = p_user_id and consumed_at is null;

  insert into public.wallet_link_challenges (nonce, wallet, auth_user_id, statement, expires_at)
  values (p_nonce, p_wallet, p_user_id, p_statement,
          now() + make_interval(secs => greatest(60, least(p_ttl_seconds, 900))));

  return jsonb_build_object('ok', true, 'nonce', p_nonce, 'statement', p_statement);
end;
$$;